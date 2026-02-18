# Quire — Phase 6: Edit PDF & File-to-PDF Conversion

Read SPEC.md for architecture. Phases 1-5 must be complete. This phase adds 2 new tools across 2 categories (Edit, Convert). These tools are more complex than earlier phases — they introduce a full-page interactive editor and new third-party dependencies.

**New dependencies** (install at start of this phase):
```
mammoth         — DOCX to HTML/text extraction (lazy-loaded, only when .docx files are added)
@pdf-lib/fontkit — Custom font embedding (already used for non-Latin text in Phase 3)
pdfjs-dist      — Already installed from Phase 1. Must be v3.4+ (requires saveDocument(), AnnotationStorage,
                   AnnotationMode.ENABLE_STORAGE, convertToViewportPoint()). Pin to same version used in Phases 1-5.
                   If current version is <3.4, upgrade before starting this phase.
```

**Required static assets**:
```
public/fonts/NotoSans-Regular.ttf        — Latin, Cyrillic, Greek (~550KB)
public/fonts/NotoSansArabic-Regular.ttf   — Arabic script (~150KB)
public/fonts/NotoSansDevanagari-Regular.ttf — Devanagari script (~200KB)
```
Download all three from Google Fonts (https://fonts.google.com/noto). Place in `public/fonts/`. All are loaded on demand — only fetched when non-Latin text is detected.

**⚠ CJK is NOT supported in v1.** Chinese, Japanese, Korean require NotoSansSC (~8.5MB) which is impractical for a static GitHub Pages app. If CJK text is detected, show an error toast: "Chinese, Japanese, and Korean text are not supported yet." See the Noto Sans Font Bundling section for detection logic.

**⚠ GitHub Pages base path.** This app is deployed to `https://username.github.io/repo-name/`. All asset URLs must use Vite's base path — `${import.meta.env.BASE_URL}fonts/NotoSans-Regular.ttf` — NOT absolute paths like `/fonts/...` which resolve to the domain root, missing the repo-name prefix.

**Required CSS** (for Edit PDF AnnotationLayer):
```
pdfjs-dist/web/pdf_viewer.css — or extract only .annotationLayer rules (~2KB)
```

**Both tools have `pipelineCompatible: false`.** Edit PDF requires an interactive canvas editor. Convert to PDF accepts non-PDF inputs. Neither fits the single-PDF-in → single-PDF-out pipeline model.

---

## Tool 14: Edit PDF

This is the most complex tool in Quire. Unlike other tools that use the standard FileDropZone → options → Process → Download flow, Edit PDF needs a full-page interactive PDF viewer with three editing modes.

### Architecture Overview

The Edit PDF tool has two phases: **Edit Mode** (interactive, on main thread) and **Save** (worker-based, produces output PDF).

```
┌─────────────────────────────────────────────────────┐
│  EditPDFTool.tsx                                     │
│  ┌──────────────┐  ┌─────────────────────────────┐  │
│  │ Page          │  │  PDFEditorCanvas.tsx         │  │
│  │ Navigation    │  │  ┌───────────────────────┐  │  │
│  │ (thumbnails)  │  │  │ Canvas Layer (PDF.js)  │  │  │
│  │               │  │  │ — read-only render     │  │  │
│  │ Page 1 ■      │  │  ├───────────────────────┤  │  │
│  │ Page 2        │  │  │ Form Layer (PDF.js     │  │  │
│  │ Page 3        │  │  │  AnnotationLayer)      │  │  │
│  │               │  │  ├───────────────────────┤  │  │
│  │               │  │  │ Edit Overlay Layer     │  │  │
│  │               │  │  │ — text boxes           │  │  │
│  │               │  │  │ — text edit regions    │  │  │
│  │               │  │  └───────────────────────┘  │  │
│  └──────────────┘  └─────────────────────────────┘  │
│  ┌────────────────────────────────────────────────┐  │
│  │ Toolbar: [Form Fill] [Add Text] [Edit Text]    │  │
│  │          Font / Size / Color  |  [Save PDF]    │  │
│  └────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
```

### Layer Stack (z-index order, bottom to top)

1. **Canvas Layer**: PDF.js renders the current page to a `<canvas>`. Read-only. Provides the visual base.
2. **Form Layer**: PDF.js `AnnotationLayer` renders interactive HTML form widgets (`<input>`, `<select>`, `<textarea>`) over detected AcroForm fields. Only visible when form fields exist.
3. **Edit Overlay Layer**: A transparent `<div>` with `position: absolute` matching canvas dimensions. Hosts user-created text boxes and text-edit regions. Pointer events pass through to Form Layer when not actively editing.

**Layer pointer-events management** (critical for mode switching):
- **Form Fill mode**: Form Layer gets `pointer-events: auto`, Edit Overlay Layer gets `pointer-events: none`. User interacts with form widgets directly.
- **Add Text / Edit Text mode**: Form Layer gets `pointer-events: none`, Edit Overlay Layer gets `pointer-events: auto`. Prevents accidental form field focus while dragging text boxes or clicking edit regions.
- Toggle these whenever the mode changes in `editorStore`.

### State Management

Create a dedicated Zustand store for the editor:

```typescript
// src/stores/editorStore.ts
interface EditorState {
  mode: 'form' | 'addText' | 'editText';
  currentPage: number;
  zoom: number;                        // 0.5 to 3.0, default 1.0
  textBoxes: TextBox[];                // user-added text overlays
  textEdits: TextEdit[];               // cover-and-replace edits
  hasFormFields: boolean;              // detected on load
  isDirty: boolean;                    // any unsaved changes
  selectedTextBoxId: string | null;
  textStyle: TextStyle;               // current style for new text
  // Undo stack
  undoStack: EditorAction[];           // past actions (push on each edit)
  redoStack: EditorAction[];           // undone actions (push on undo, clear on new edit)
  // Extracted text items per page (for Edit Text mode)
  // Use Record (not Map) — Maps break with Zustand devtools/persist middleware
  // because JSON.stringify(new Map()) returns "{}"
  extractedText: Record<number, ExtractedTextItem[]>;
  // Page rotation cache (for coordinate conversion)
  pageRotations: Record<number, number>;  // pageIndex → rotation degrees (0/90/180/270)
}

type EditorAction =
  | { type: 'addTextBox'; textBox: TextBox }
  | { type: 'moveTextBox'; id: string; from: { x: number; y: number }; to: { x: number; y: number } }
  | { type: 'resizeTextBox'; id: string; from: { width: number; height: number }; to: { width: number; height: number } }
  | { type: 'deleteTextBox'; textBox: TextBox }
  | { type: 'editTextBox'; id: string; fromText: string; toText: string }
  | { type: 'addTextEdit'; textEdit: TextEdit }
  | { type: 'removeTextEdit'; textEdit: TextEdit };

// Undo: pop from undoStack, reverse the action, push to redoStack
// Redo: pop from redoStack, re-apply, push to undoStack
// On any NEW edit action: clear redoStack (no redo after new edits)
// Keyboard: Ctrl+Z = undo, Ctrl+Shift+Z = redo

interface TextBox {
  id: string;
  pageIndex: number;      // 0-based
  x: number;              // PDF coordinate space (bottom-left origin, unscaled)
  y: number;              // PDF coordinate space
  width: number;          // PDF coordinate space (points)
  height: number;         // PDF coordinate space (points)
  text: string;
  style: TextStyle;
}

interface TextEdit {
  id: string;
  pageIndex: number;
  originalBounds: { x: number; y: number; width: number; height: number }; // ALL in PDF coordinate space (points, bottom-left origin)
  originalText: string;
  newText: string;
  style: TextStyle;
  originalFontName: string;  // PDF.js font name from extracted text (for font mapping)
  coverColor: string;        // hex color for cover rectangle, default '#FFFFFF'
}

interface TextStyle {
  fontFamily: 'helvetica' | 'times' | 'courier';
  fontSize: number;       // 8-72, default 12
  color: string;          // hex color, default '#000000'
  bold: boolean;
  italic: boolean;
}

interface ExtractedTextItem {
  str: string;
  // ALL coordinates in PDF space (points, bottom-left origin, UNSCALED)
  x: number;              // from transform[4]
  y: number;              // from transform[5] (NOT viewport-converted — keep raw PDF Y)
  width: number;          // from item.width (already in PDF user-space points, no scale conversion needed)
  height: number;         // from Math.abs(transform[3])
  fontName: string;       // PDF.js font name (e.g., "g_d0_f1" or "Helvetica")
  fontSize: number;       // approximate, from Math.abs(transform[3])
  pageIndex: number;
}
```

**CRITICAL COORDINATE RULE**: All bounds stored in `TextBox`, `TextEdit`, and `ExtractedTextItem` are in **PDF coordinate space** (points, bottom-left origin, unscaled). Conversion to/from screen coordinates happens ONLY in the rendering/interaction layer, never in stored state or worker operations. This prevents zoom-dependent bugs.

### AnnotationLayer CSS (required)

PDF.js AnnotationLayer requires specific CSS for form widgets to render correctly. Without it, inputs/checkboxes/dropdowns stack in the top-left corner instead of positioning over their form fields.

```typescript
// Import in EditPDFTool.tsx or PDFEditorCanvas.tsx:
import 'pdfjs-dist/web/pdf_viewer.css';
// This includes styles for .annotationLayer, .annotationLayer input, etc.
// If the full viewer CSS is too heavy, extract only the .annotationLayer rules
// into a local CSS file (~2KB).
```

### Mode 1: Form Fill

**When it activates**: On PDF load, check if document has AcroForm fields. If yes, show "This PDF has fillable form fields" banner and auto-select Form Fill mode. If no form fields exist, disable this mode button (grey out, tooltip: "No form fields detected").

**How it works**:
1. PDF.js `AnnotationLayer` renders interactive form widgets over the canvas — use `AnnotationMode.ENABLE_STORAGE` so PDF.js tracks all form changes in its `AnnotationStorage`
2. User fills fields natively (typing in inputs, checking boxes, selecting dropdowns)
3. On save: use PDF.js's own `saveDocument()` to produce a PDF with filled form data — no manual DOM scraping or field name mapping needed

**⚠ CRITICAL ARCHITECTURE NOTE — use `saveDocument()`, NOT DOM scraping.**

The old approach of extracting values from DOM elements and mapping `data-annotation-id` → pdf-lib field names is fragile and the #1 source of bugs in PDF form tools. PDF.js AnnotationLayer uses annotation object IDs in the DOM, which do NOT reliably map to the `/T` field names that pdf-lib uses. Different PDF generators produce different ID schemes.

Instead, use PDF.js's built-in `saveDocument()` API:

```typescript
// When loading the PDF, enable annotation storage:
const pdfDoc = await pdfjsLib.getDocument({
  data: pdfBytes,
  // ENABLE_STORAGE mode tracks user form input automatically
}).promise;

// Render AnnotationLayer with storage enabled:
const annotationLayer = new pdfjsLib.AnnotationLayer({
  div: annotationLayerDiv,
  viewport: clonedViewport,
  page: pageProxy,
  annotationStorage: pdfDoc.annotationStorage, // <-- key line
});
await annotationLayer.render({
  annotations: await pageProxy.getAnnotations({ intent: 'display' }),
  // ... linkService, etc.
});

// On save — form values are already tracked by annotationStorage:
const formFilledPdfBytes = await pdfDoc.saveDocument();
// formFilledPdfBytes is a Uint8Array of the PDF with all form values baked in
```

**Save flow for forms**: `saveDocument()` returns a complete PDF with form data. If the user also made text edits (Add Text / Edit Text), pass the `saveDocument()` output as input to the worker, which then applies text overlays/edits on top via pdf-lib. If the user ONLY filled forms (no text edits), `saveDocument()` output IS the final PDF — no worker needed.

```typescript
// Save orchestration in EditPDFTool.tsx:
async function handleSave() {
  let pdfBytes: Uint8Array;

  // Step 1: If form fields exist and were modified, use saveDocument()
  if (hasFormFields && pdfDocProxy.annotationStorage.size > 0) {
    pdfBytes = await pdfDocProxy.saveDocument();
  } else {
    pdfBytes = originalPdfBytes; // unchanged
  }

  // Step 2: If there are text edits, send to worker
  const hasTextEdits = textBoxes.length > 0 || textEdits.length > 0;
  if (hasTextEdits) {
    const result = await workerClient.process('edit-pdf', [pdfBytes], {
      textBoxes,
      textEdits,
      flattenForm: flattenFormChecked, // optional post-save flatten
    });
    pdfBytes = result.files[0].bytes;
  }

  // Step 3: If flatten requested but no text edits, still need worker for flatten
  if (flattenFormChecked && !hasTextEdits) {
    const result = await workerClient.process('edit-pdf', [pdfBytes], {
      textBoxes: [],
      textEdits: [],
      flattenForm: true,
    });
    pdfBytes = result.files[0].bytes;
  }

  // pdfBytes is now the final output
}
```

**Flatten form** (optional): If user checks "Flatten form", the worker loads the saveDocument() output with pdf-lib and calls `form.flatten()`. This converts form fields to static content.

### Mode 2: Add Text

**How it works**:
1. User selects "Add Text" mode from toolbar
2. Cursor changes to crosshair
3. User clicks on the page → creates a positioned text box (initially empty)
4. A `<textarea>` appears at click position, user types
5. Toolbar shows font/size/color controls that update selected text box
6. User can drag text boxes to reposition, drag corners to resize
7. Click outside to deselect. Click text box to re-select and edit.

**Coordinate conversion** (critical — bidirectional):
- The Edit Overlay Layer is sized to match the canvas pixel dimensions
- PDF.js renders at `scale * CSS_PIXELS_PER_POINT`
- User clicks are in screen pixels → convert to overlay-relative pixels → convert to PDF coordinate space
- PDF coordinate space: origin is bottom-left, Y increases upward
- Screen coordinate space: origin is top-left, Y increases downward
- **Both directions are needed**: screen→PDF for capturing clicks, PDF→screen for rendering text boxes/highlights

```typescript
// Screen → PDF: for capturing user clicks and converting to stored coordinates
function screenToPDF(
  clickX: number, clickY: number,
  canvasRect: DOMRect,
  viewport: PDFPageViewport
): { x: number; y: number } {
  const relX = clickX - canvasRect.left;
  const relY = clickY - canvasRect.top;
  // convertToPdfPoint handles rotation, scale, and Y-flip automatically
  const [pdfX, pdfY] = viewport.convertToPdfPoint(relX, relY);
  return { x: pdfX, y: pdfY };
}

// PDF → Screen: for rendering stored text boxes / edit highlights in the overlay
// This is the INVERSE of screenToPDF — needed for positioning DOM elements
function pdfToScreen(
  pdfX: number, pdfY: number,
  viewport: PDFPageViewport
): { screenX: number; screenY: number } {
  // viewport.convertToViewportPoint handles rotation + scale + Y-flip
  const [screenX, screenY] = viewport.convertToViewportPoint(pdfX, pdfY);
  return { screenX, screenY };
}

// Convert a PDF-space rectangle to screen-space for overlay rendering
function pdfRectToScreen(
  bounds: { x: number; y: number; width: number; height: number },
  viewport: PDFPageViewport
): { left: number; top: number; width: number; height: number } {
  // Convert bottom-left corner
  const bottomLeft = pdfToScreen(bounds.x, bounds.y, viewport);
  // Convert top-right corner
  const topRight = pdfToScreen(bounds.x + bounds.width, bounds.y + bounds.height, viewport);
  return {
    left: Math.min(bottomLeft.screenX, topRight.screenX),
    top: Math.min(bottomLeft.screenY, topRight.screenY),
    width: Math.abs(topRight.screenX - bottomLeft.screenX),
    height: Math.abs(topRight.screenY - bottomLeft.screenY),
  };
}
```

**Page rotation handling**: PDFs can have pages with `/Rotate` set to 90, 180, or 270 degrees. PDF.js handles rotation in its viewport — `convertToPdfPoint` and `convertToViewportPoint` both account for rotation automatically. Cache page rotations on load:
```typescript
// On page load:
const page = await pdfDoc.getPage(pageNum);
const rotation = page.rotate; // 0, 90, 180, or 270
editorStore.pageRotations[pageIndex] = rotation;
```
No special coordinate math needed as long as ALL conversions go through the viewport methods above. Do NOT manually flip Y or adjust for rotation — let PDF.js handle it.

**Rendering text boxes in the overlay**: When rendering a stored `TextBox` as a DOM element in the Edit Overlay Layer, always convert from PDF → screen coordinates using the CURRENT viewport (which includes current zoom level):
```typescript
function renderTextBoxOverlay(textBox: TextBox, viewport: PDFPageViewport) {
  const screenRect = pdfRectToScreen(
    { x: textBox.x, y: textBox.y, width: textBox.width, height: textBox.height },
    viewport
  );
  // Position the <textarea> element at screenRect.left, screenRect.top
  // with screenRect.width, screenRect.height
}
// Re-render all overlays whenever zoom changes
```

**Worker operation** (add text portion):
```typescript
// Shared helper: resolve standard font from family + bold/italic
function getStandardFont(
  family: 'helvetica' | 'times' | 'courier',
  bold: boolean,
  italic: boolean
): StandardFonts {
  if (family === 'times') {
    if (bold && italic) return StandardFonts.TimesRomanBoldItalic;
    if (bold) return StandardFonts.TimesRomanBold;
    if (italic) return StandardFonts.TimesRomanItalic;
    return StandardFonts.TimesRoman;
  }
  if (family === 'courier') {
    if (bold && italic) return StandardFonts.CourierBoldOblique;
    if (bold) return StandardFonts.CourierBold;
    if (italic) return StandardFonts.CourierOblique;
    return StandardFonts.Courier;
  }
  // helvetica (default)
  if (bold && italic) return StandardFonts.HelveticaBoldOblique;
  if (bold) return StandardFonts.HelveticaBold;
  if (italic) return StandardFonts.HelveticaOblique;
  return StandardFonts.Helvetica;
}

for (const textBox of textBoxes) {
  const page = pdfDoc.getPages()[textBox.pageIndex];
  const fontEnum = getStandardFont(
    textBox.style.fontFamily,
    textBox.style.bold,
    textBox.style.italic
  );
  const font = await pdfDoc.embedFont(fontEnum);

  const { r, g, b } = hexToRgb(textBox.style.color);
  page.drawText(textBox.text, {
    x: textBox.x,
    y: textBox.y,
    size: textBox.style.fontSize,
    font: font,
    color: rgb(r / 255, g / 255, b / 255),
    maxWidth: textBox.width,
    lineHeight: textBox.style.fontSize * 1.2,
  });
}
```

**Non-Latin text handling**: If text contains non-Latin characters, use `detectRequiredFonts()` from `src/lib/fonts.ts` to identify the script. Load the appropriate Noto Sans variant via `getNotoSansFont(script)`. If CJK is detected, show error toast and fall back to Helvetica (CJK unsupported in v1). For supported scripts (Cyrillic, Greek, Arabic, Devanagari), embed with `@pdf-lib/fontkit` and `{ subset: true }`. Show a subtle info toast: "Using Noto Sans for Unicode text support."

### Mode 3: Edit Text (Cover-and-Replace)

**⚠ CRITICAL LIMITATION — Display prominently in UI:**
> "Text editing works by covering original text and placing new text on top. Font matching is approximate. Best for simple edits like fixing typos or changing names. Complex layouts may not look right."

Show this as a dismissible info banner when Edit Text mode is first activated.

**Additional limitation (cover color):** The cover rectangle defaults to white. On PDFs with colored backgrounds, images behind text, or watermarks, the white rectangle will be visible. Offer a cover color picker in the toolbar when Edit Text mode is active, defaulting to `#FFFFFF`. Store the selected cover color in each `TextEdit.coverColor`.

**How it works**:
1. **Lazy extraction**: When the user navigates to a page AND Edit Text mode is active, extract text items for that page via `page.getTextContent()`. Cache in `editorStore.extractedText[pageIndex]` so re-navigation is instant. Do NOT extract all pages on load — a 200-page PDF would stall for 5-10 seconds.
2. In Edit Text mode, render clickable highlight regions over each text item on the Edit Overlay Layer
3. On hover: show subtle highlight (light blue background, 0.2 opacity)
4. On click: the text item becomes editable — render an `<input>` or `<textarea>` positioned exactly over the text region, pre-filled with the original text
5. User edits the text and clicks away or presses Enter to confirm
6. Store the edit as a `TextEdit` entry, with `originalFontName` captured from the extracted text item

**⚠ Text extraction — coordinates are already in PDF space:**

`getTextContent()` returns items with all values in PDF user-space units (points). The `transform` matrix and `width` are NOT affected by any viewport or scale — `getTextContent()` doesn't accept a viewport parameter. No scale conversion is needed.

```typescript
// Extract text for the CURRENT page only (lazy — called on page navigation in Edit Text mode)
async function extractTextForPage(page: PDFPageProxy, pageIndex: number) {
  // Skip if already cached
  if (editorStore.extractedText[pageIndex]) return;

  const textContent = await page.getTextContent();
  // getTextContent() returns ALL values in PDF user-space (points, bottom-left origin).
  // No viewport or scale conversion needed — width and transform are always in points.
  const items: ExtractedTextItem[] = textContent.items
    .filter(item => item.str.trim()) // skip empty items
    .map(item => {
      const fontSize = Math.abs(item.transform[3]);
      return {
        str: item.str,
        // transform[4] and transform[5] are PDF coordinates (points, bottom-left origin)
        x: item.transform[4],
        y: item.transform[5],       // ← RAW PDF Y. Do NOT flip.
        width: item.width,           // ← already in PDF points. No scale division needed.
        height: fontSize,            // approximate: fontSize ≈ text height
        fontName: item.fontName,     // e.g., "g_d0_f1", "Helvetica-Bold"
        fontSize,
        pageIndex,
      };
    });
  editorStore.extractedText[pageIndex] = items;
}

// Call when entering Edit Text mode or navigating pages while in Edit Text mode:
// await extractTextForPage(currentPageProxy, currentPageIndex);
```

**Rendering highlights in the overlay**: Use the `pdfRectToScreen()` helper from Mode 2 to convert the PDF-space `ExtractedTextItem` bounds to screen-space positions for the highlight overlay. This automatically handles zoom level and page rotation.

**Worker operation** (edit text portion):
```typescript
for (const edit of textEdits) {
  const page = pdfDoc.getPages()[edit.pageIndex];
  const { x, y, width, height } = edit.originalBounds;
  // originalBounds are in PDF coordinate space — use directly with pdf-lib

  // Step 1: Draw cover rectangle over original text
  // Use the user-selected cover color (stored per edit)
  const { r: cr, g: cg, b: cb } = hexToRgb(edit.coverColor);
  // y from transform[5] is the text BASELINE. Descenders (g, p, q, y) extend
  // ~25% below baseline. Ascenders extend ~75% above baseline within fontSize.
  // Cover from (baseline - 25% of fontSize) to (baseline + 80% of fontSize)
  // with 1pt safety padding on all sides.
  const descenderOffset = height * 0.25;
  const coverY = y - descenderOffset - 1;
  const coverHeight = height + descenderOffset + 2;
  page.drawRectangle({
    x: x - 1,
    y: coverY,
    width: width + 2,
    height: coverHeight,
    color: rgb(cr / 255, cg / 255, cb / 255),
    borderWidth: 0,
  });

  // Step 2: Draw new text on top
  // Use mapPDFJsFontToStandard with the ORIGINAL font name from the extracted text,
  // NOT the user's style.fontFamily — this gives better visual matching
  const fontEnum = mapPDFJsFontToStandard(edit.originalFontName);
  const font = await pdfDoc.embedFont(fontEnum);
  const { r, g, b } = hexToRgb(edit.style.color);
  page.drawText(edit.newText, {
    x: x,
    y: y,   // PDF y-coordinate — already in correct space
    size: edit.style.fontSize,
    font: font,
    color: rgb(r / 255, g / 255, b / 255),
  });
}
```

**Font mapping** (PDF.js font name → pdf-lib StandardFont):
```typescript
// Called with the ORIGINAL PDF.js font name (e.g., "g_d0_f1", "Helvetica-Bold",
// "TimesNewRomanPSMT"), NOT the user's style.fontFamily selection.
// This gives better visual matching for cover-and-replace edits.
function mapPDFJsFontToStandard(pdfJsFontName: string): StandardFonts {
  const name = pdfJsFontName.toLowerCase();
  // Check for Times/serif family
  if (name.includes('times') || name.includes('serif')) {
    if (name.includes('bold') && name.includes('ital')) return StandardFonts.TimesRomanBoldItalic;
    if (name.includes('bold')) return StandardFonts.TimesRomanBold;
    if (name.includes('ital')) return StandardFonts.TimesRomanItalic;
    return StandardFonts.TimesRoman;
  }
  // Check for Courier/mono family
  if (name.includes('courier') || name.includes('mono')) {
    if (name.includes('bold') && (name.includes('oblique') || name.includes('ital'))) return StandardFonts.CourierBoldOblique;
    if (name.includes('bold')) return StandardFonts.CourierBold;
    if (name.includes('oblique') || name.includes('ital')) return StandardFonts.CourierOblique;
    return StandardFonts.Courier;
  }
  // Default: Helvetica family
  if (name.includes('bold') && (name.includes('oblique') || name.includes('ital'))) return StandardFonts.HelveticaBoldOblique;
  if (name.includes('bold')) return StandardFonts.HelveticaBold;
  if (name.includes('oblique') || name.includes('ital')) return StandardFonts.HelveticaOblique;
  return StandardFonts.Helvetica; // default fallback
}
```
This is approximate by design. Perfect font matching is impossible with standard fonts — document this clearly. The function now detects bold/italic variants from the original font name for better visual matching.

### Component: EditPDFTool.tsx

**Layout**: Full-width editor, NOT the standard split-panel tool layout. Use a dedicated route `#edit-pdf`.

**Top toolbar**:
- Mode tabs: `[Form Fill]` `[Add Text]` `[Edit Text]` — mutually exclusive selection, Form Fill greyed out if no form fields detected
- When Add Text selected: font family dropdown (Helvetica, Times, Courier), font size input (8-72), color picker, bold toggle, italic toggle
- When Edit Text selected: same font controls + **cover color picker** (defaults to white `#FFFFFF`, used for the rectangle that covers original text). Tooltip: "Match this to the page background color."
- Right side: Zoom control (-, +, fit width, percentage display), `[Save PDF]` button (primary CTA, disabled until `isDirty`)
- Optional: `[Flatten Form]` checkbox (appears only when form fields exist) — flattens form fields into static content on save
- Undo/Redo buttons (↩ / ↪) — enabled when undoStack/redoStack have entries

**Left sidebar** (collapsible):
- Page thumbnails (vertical strip, same ThumbnailGrid component from Phase 1 but in vertical single-column mode)
- Current page highlighted
- Click to navigate

**Center**: PDFEditorCanvas with the 3 layer stack

**Bottom bar**: Page indicator "Page 3 of 12", keyboard shortcut hints ("Click to add text", "Click text to edit", "Ctrl+Z to undo")

**Save flow** (two-phase: PDF.js saveDocument for forms, then worker for text edits):

The save is orchestrated in the main thread component, NOT purely in the worker:
1. User clicks "Save PDF"
2. **Phase 1 — Forms**: If the PDF has form fields and user modified any (annotationStorage.size > 0), call `pdfDocProxy.saveDocument()` on main thread. This produces a complete PDF with form values baked in. If no form changes, use the original PDF bytes.
3. **Phase 2 — Text edits**: If there are any `textBoxes` or `textEdits`, send the Phase 1 output to the worker:
   ```typescript
   workerClient.process('edit-pdf', [phase1PdfBytes], {
     textBoxes,
     textEdits,
     flattenForm: flattenFormChecked,
   });
   ```
4. If ONLY form changes and no text edits, the `saveDocument()` output is the final PDF (worker only needed if `flattenForm` is checked).
5. Return modified PDF → standard PreviewPanel + DownloadPanel

See the full save orchestration code in the Mode 1: Form Fill section above.

**Unsaved changes guard**: If `isDirty` is true and user navigates away (hash change or browser close), show confirmation dialog: "You have unsaved edits. Leave without saving?"

**Keyboard shortcuts**:
- `Ctrl+Z` / `Cmd+Z`: Undo last action
- `Ctrl+Shift+Z` / `Cmd+Shift+Z`: Redo
- `Delete` / `Backspace`: Delete selected text box (when in Add Text mode)
- `Escape`: Deselect current text box / cancel current edit

### Worker Operation: `edit-pdf`

Receives: PDF bytes (already form-filled via `saveDocument()` if applicable) + `{ textBoxes, textEdits, flattenForm }`

**Note**: The worker no longer handles form filling — that's done by PDF.js `saveDocument()` on the main thread. The worker only handles text overlays, text edits, and optional form flattening.

Processing order:
1. Load PDF with `PDFDocument.load(bytes)`
2. Optionally flatten form (`form.flatten()`) — if user checked "Flatten form"
3. Draw text boxes (iterate `textBoxes`, draw on respective pages)
4. Apply text edits (iterate `textEdits`, cover rect + new text on respective pages)
5. `pdfDoc.save()` → return output

Progress: report per-step (2 steps: text boxes, text edits)

### Tests

- Load PDF with form fields → fill text field, check checkbox → save → verify field values in output (load output with pdf-lib `getForm()`)
- Load PDF with form fields → fill and flatten → verify form fields are removed from output
- **Form save via saveDocument**: fill form → save → reload output → verify `annotationStorage` was serialized correctly (values persist)
- Add text box at known coordinates → save → extract text from output at same coordinates → verify text present
- **Add Text bold/italic**: Add text box with bold=true → save → verify output uses HelveticaBold font (not regular Helvetica)
- Edit text: load simple PDF with known text → edit one word → save → verify cover rectangle exists at original position and new text is present
- **Cover color**: Edit text with cover color `#FF0000` → save → verify rectangle at original position has red fill, not white
- **Cover rectangle coverage**: Edit text containing "gypsy" → verify cover rectangle extends below baseline (descenders covered)
- Load PDF without form fields → verify Form Fill mode is disabled
- **Coordinate round-trip**: `screenToPDF` → `pdfToScreen` for same viewport produces identity (within 0.1pt tolerance). Test at zoom 0.5x, 1x, 2x, 3x.
- **Coordinate with rotation**: Load PDF with 90° rotated page → verify `screenToPDF` + `pdfToScreen` round-trip still works
- **Text extraction values**: verify `ExtractedTextItem.width` values are in PDF points by comparing with known text widths from fixture
- **Lazy text extraction**: Load 50-page PDF → enter Edit Text mode on page 1 → verify `extractedText` has entry for page 0 only (not all 50 pages)
- **Undo/redo**: Add text box → undo → verify text box removed → redo → verify text box restored
- **Undo across types**: Add text box → edit text → undo → verify text edit removed but text box still exists
- **Pointer-events isolation**: In Add Text mode, click location over a form field → verify text box created, not form field focused

### Edge Cases

- PDF with no text content (scanned/image-only): Edit Text mode should show "No editable text found on this page" message
- PDF with overlapping text items: clicking should select the topmost item
- Very long text in Add Text mode: word-wrap within the text box bounds using `maxWidth`
- Password-protected PDF: must unlock first (redirect to Unlock tool or prompt for password on load)
- **Rotated pages** (90°/180°/270°): Text boxes and edit highlights must render at correct positions. Test with rotated fixture PDF.
- **Non-white backgrounds**: Document that cover color must be manually set by user. No auto-detection (would require canvas pixel sampling, too complex for v1).
- **CJK text in Edit Text mode**: If extracted text contains CJK characters, show error toast when user tries to edit those items.

---


## Tool 15: Convert to PDF

A single tool that accepts **any combination** of images (.jpg, .png, .webp, .gif), Word documents (.docx), and plain text files (.txt), and produces one unified PDF. Files are added to an ordered list, each converted to PDF pages, and concatenated in the user-specified order.

### Architecture Overview

```
User adds mixed files (drag & drop or file picker)
  ↓
File list with drag-and-drop reorder
  ↓
Each file preprocessed on main thread:
  • Images → read dimensions, convert WebP/GIF to PNG
  • DOCX → mammoth.convertToHtml() → parse to DocBlock[]
  • TXT → split into paragraphs → DocBlock[]
  ↓
Send preprocessed data to worker
  ↓
Worker processes files in order, appending pages to single PDFDocument
  ↓
Output: one combined PDF
```

### Input Types

```typescript
type ConvertInputFile =
  | { type: 'image'; id: string; name: string; bytes: Uint8Array; mimeType: string; width: number; height: number }
  | { type: 'docx'; id: string; name: string; blocks: DocBlock[]; warnings: string[] }
  | { type: 'txt'; id: string; name: string; blocks: DocBlock[] };
```

**Accept**: `.jpg`, `.jpeg`, `.png`, `.webp`, `.gif`, `.docx`, `.txt`
**Max files**: 50 total

### Main Thread Preprocessing

When a user adds files, preprocessing happens immediately (before they click "Convert"):

**Images**:
```typescript
async function preprocessImage(file: File): Promise<ConvertInputFile> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let mimeType = file.type;
  let processedBytes = bytes;

  // Load image once to get dimensions (and for potential conversion)
  const img = new Image();
  img.src = URL.createObjectURL(file);
  await new Promise((resolve, reject) => {
    img.onload = resolve;
    img.onerror = reject;
  });
  let width = img.naturalWidth;
  let height = img.naturalHeight;

  // WebP/GIF → PNG conversion (pdf-lib only supports JPG/PNG)
  // Reuse the already-loaded img — no need to create a second Image object
  if (mimeType === 'image/webp' || mimeType === 'image/gif') {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    canvas.getContext('2d')!.drawImage(img, 0, 0);
    const blob = await new Promise<Blob>(r => canvas.toBlob(b => r(b!), 'image/png'));
    processedBytes = new Uint8Array(await blob.arrayBuffer());
    mimeType = 'image/png';
    // Note: animated GIFs — canvas.drawImage captures first frame only
  }

  URL.revokeObjectURL(img.src);
  return {
    type: 'image' as const,
    id: crypto.randomUUID(),
    name: file.name,
    bytes: processedBytes,
    mimeType,
    width,
    height,
  };
}
```

**DOCX** (lazy-load mammoth — ~230KB, only loaded when first .docx file is added):
```typescript
// DO NOT import mammoth at module level — lazy-load on demand
// import mammoth from 'mammoth';  ← WRONG, wastes ~230KB for image-only conversions

let mammothModule: typeof import('mammoth') | null = null;
async function getMammoth() {
  if (!mammothModule) {
    mammothModule = await import('mammoth');
  }
  return mammothModule.default;
}

async function preprocessDocx(file: File): Promise<ConvertInputFile> {
  const mammoth = await getMammoth();
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.convertToHtml(
    { arrayBuffer },
    {
      styleMap: [
        "p[style-name='Heading 1'] => h1",
        "p[style-name='Heading 2'] => h2",
        "p[style-name='Heading 3'] => h3",
      ],
    }
  );
  const blocks = parseHtmlToBlocks(result.value); // see HTML parser below
  return {
    type: 'docx',
    id: crypto.randomUUID(),
    name: file.name,
    blocks,
    warnings: result.messages.map(m => m.message),
  };
}
```

**TXT**:
```typescript
async function preprocessTxt(file: File): Promise<ConvertInputFile> {
  const text = await file.text(); // UTF-8 by default
  const paragraphs = text.split(/\n\s*\n/); // split on blank lines
  const blocks: DocBlock[] = paragraphs
    .filter(p => p.trim())
    .map(p => ({
      type: 'paragraph' as const,
      runs: [{ text: p.replace(/\n/g, ' ').trim(), bold: false, italic: false, underline: false }],
    }));
  return { type: 'txt', id: crypto.randomUUID(), name: file.name, blocks };
}
```

### HTML Parser (for DOCX)

Parses mammoth's HTML output into structured blocks. Runs on main thread (needs DOMParser).

```typescript
interface DocBlock {
  type: 'heading1' | 'heading2' | 'heading3' | 'paragraph' | 'list-item' | 'image';
  runs: TextRun[];
  listLevel?: number;
  imageData?: Uint8Array;
  imageMimeType?: string;
}

interface TextRun {
  text: string;
  bold: boolean;
  italic: boolean;
  underline: boolean;
}
```

```typescript
function parseHtmlToBlocks(html: string): DocBlock[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const blocks: DocBlock[] = [];

  doc.body.childNodes.forEach(node => {
    // Check for images FIRST — mammoth may wrap images in <p> tags
    // If we process as paragraph first, we'd get both a paragraph block AND an image block
    const imgEl = node.nodeName === 'IMG' ? node : (node as Element).querySelector?.('img');
    if (imgEl?.getAttribute('src')?.startsWith('data:')) {
      const src = imgEl.getAttribute('src')!;
      const [header, b64] = src.split(',');
      const mimeType = header.match(/data:(.*?);/)?.[1] || 'image/png';
      const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
      blocks.push({ type: 'image', runs: [], imageData: bytes, imageMimeType: mimeType });
    } else if (node.nodeName === 'H1') {
      blocks.push({ type: 'heading1', runs: extractRuns(node) });
    } else if (node.nodeName === 'H2') {
      blocks.push({ type: 'heading2', runs: extractRuns(node) });
    } else if (node.nodeName === 'H3') {
      blocks.push({ type: 'heading3', runs: extractRuns(node) });
    } else if (node.nodeName === 'P') {
      blocks.push({ type: 'paragraph', runs: extractRuns(node) });
    } else if (node.nodeName === 'UL' || node.nodeName === 'OL') {
      node.querySelectorAll('li').forEach(li => {
        blocks.push({ type: 'list-item', runs: extractRuns(li), listLevel: getListDepth(li) });
      });
    }
  });
  return blocks;
}

function extractRuns(node: Node): TextRun[] {
  const runs: TextRun[] = [];
  function walk(n: Node, bold: boolean, italic: boolean, underline: boolean) {
    if (n.nodeType === Node.TEXT_NODE) {
      // ⚠ Do NOT use .trim() here — it strips boundary whitespace between
      // inline elements, causing "Hello <strong>world</strong> foo" to become
      // "Helloworldfoo". Only skip completely empty text nodes.
      const text = n.textContent || '';
      if (text.length > 0) {
        runs.push({ text, bold, italic, underline });
      }
    } else if (n.nodeType === Node.ELEMENT_NODE) {
      const el = n as Element;
      const b = bold || el.tagName === 'STRONG' || el.tagName === 'B';
      const i = italic || el.tagName === 'EM' || el.tagName === 'I';
      const u = underline || el.tagName === 'U';
      el.childNodes.forEach(child => walk(child, b, i, u));
    }
  }
  walk(node, false, false, false);
  return runs;
}

function getListDepth(li: Element): number {
  let depth = 0;
  let el: Element | null = li;
  while (el) {
    if (el.tagName === 'UL' || el.tagName === 'OL') depth++;
    el = el.parentElement;
  }
  return Math.max(0, depth - 1); // first level = 0
}
```

### Worker Operation: `convert-to-pdf`

Receives: `{ files: ConvertInputFile[], config: ConvertConfig }`

**⚠ Transferable buffers**: Image `bytes` fields are `Uint8Array` which get structured-cloned (copied) by default in `postMessage`. For 50 images at 5MB each, that's 250MB cloned. Extract all `Uint8Array` buffers and pass them as Transferables:
```typescript
// In main thread, before postMessage:
// Use a Set to prevent DataCloneError if two Uint8Arrays share the same underlying ArrayBuffer
const transferables = new Set<ArrayBuffer>();
for (const file of files) {
  if (file.type === 'image') {
    transferables.add(file.bytes.buffer);
  }
  if ((file.type === 'docx' || file.type === 'txt') && file.blocks) {
    for (const block of file.blocks) {
      if (block.imageData) transferables.add(block.imageData.buffer);
    }
  }
}
worker.postMessage({ files, config }, [...transferables]);
// Note: after transfer, the original bytes are detached (zero-length)
// This is fine since main thread no longer needs them after sending to worker
```

```typescript
interface ConvertConfig {
  // Document page settings (apply to DOCX and TXT content)
  docPageSize: 'a4' | 'letter' | 'legal' | 'a3' | 'a5';   // default 'a4'
  docOrientation: 'portrait' | 'landscape';                   // default 'portrait'
  textFontSize: number;         // default 12
  textLineHeight: number;       // multiplier, default 1.5

  // Image page settings (apply to image files only)
  imagePageSize: 'fit-to-image' | 'a4' | 'letter' | 'legal' | 'a3' | 'a5';  // default 'fit-to-image'
  imageOrientation: 'auto' | 'portrait' | 'landscape';       // default 'auto'
  imageFitMode: 'contain' | 'cover' | 'stretch' | 'original'; // only when imagePageSize !== 'fit-to-image'

  // Shared settings
  margin: number;               // points, default 36 (0.5 inch). 0 is valid.
}
```

**Note on `margin`**: The margin field allows 0 as a valid value. Use nullish coalescing (`??`) not logical OR (`||`) when applying defaults, since `0 || 72` incorrectly treats 0 as falsy and defaults to 72.

**Processing logic — iterate files in order, appending pages to one PDFDocument**:

```typescript
operations['convert-to-pdf'] = async (_, options, onProgress, isCancelled) => {
  const { files, config } = options;
  const pdfDoc = await PDFDocument.create();

  // Embed fonts once for document text rendering
  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const helveticaOblique = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);
  const helveticaBoldOblique = await pdfDoc.embedFont(StandardFonts.HelveticaBoldOblique);

  for (let i = 0; i < files.length; i++) {
    if (isCancelled()) return null;
    const file = files[i];
    onProgress({ step: `Processing: ${file.name}`, current: i + 1, total: files.length });

    if (file.type === 'image') {
      await appendImagePages(pdfDoc, file, config);  // ← MUST await (embedJpg/embedPng are async)
    } else {
      // Both 'docx' and 'txt' have DocBlock[] — use same layout engine
      await appendDocumentPages(pdfDoc, file.blocks, config, {
        helvetica, helveticaBold, helveticaOblique, helveticaBoldOblique
      });  // ← MUST await (inline images call embedPng which is async)
    }
  }

  return { files: [{ name: 'converted.pdf', bytes: await pdfDoc.save() }] };
};
```

**Image page appending**:
```typescript
async function appendImagePages(  // ← async!
  pdfDoc: PDFDocument,
  file: ConvertInputFile & { type: 'image' },
  config: ConvertConfig
) {
  // Embed image — embedJpg/embedPng return Promises!
  let image;
  if (file.mimeType === 'image/jpeg') {
    image = await pdfDoc.embedJpg(file.bytes);  // ← await!
  } else {
    image = await pdfDoc.embedPng(file.bytes);   // ← await!
  }

  // Determine page dimensions — use IMAGE-specific config fields
  let pageWidth: number, pageHeight: number;
  if (config.imagePageSize === 'fit-to-image') {
    pageWidth = image.width + (config.margin ?? 36) * 2;
    pageHeight = image.height + (config.margin ?? 36) * 2;
  } else {
    [pageWidth, pageHeight] = getPageDimensions(
      config.imagePageSize, config.imageOrientation, image
    );
  }

  const margin = config.margin ?? 36;  // ← ?? not ||, so 0 is respected
  const page = pdfDoc.addPage([pageWidth, pageHeight]);
  const availW = pageWidth - margin * 2;
  const availH = pageHeight - margin * 2;
  const { drawWidth, drawHeight } = calculateFit(
    image.width, image.height, availW, availH, config.imageFitMode
  );

  // Center image on page
  const x = margin + (availW - drawWidth) / 2;
  const y = margin + (availH - drawHeight) / 2;
  page.drawImage(image, { x, y, width: drawWidth, height: drawHeight });
}

function getPageDimensions(
  size: string, orientation: string, image?: { width: number; height: number }
): [number, number] {
  const sizes: Record<string, [number, number]> = {
    a4: [595.28, 841.89], letter: [612, 792], legal: [612, 1008],
    a3: [841.89, 1190.55], a5: [419.53, 595.28],
  };
  let [w, h] = sizes[size] || sizes.a4;

  if (orientation === 'landscape' || (orientation === 'auto' && image && image.width > image.height)) {
    [w, h] = [h, w];
  }
  return [w, h];
}

function calculateFit(
  imgW: number, imgH: number, availW: number, availH: number,
  mode: 'contain' | 'cover' | 'stretch' | 'original'
): { drawWidth: number; drawHeight: number } {
  switch (mode) {
    case 'contain': {
      const scale = Math.min(availW / imgW, availH / imgH);
      return { drawWidth: imgW * scale, drawHeight: imgH * scale };
    }
    case 'cover': {
      const scale = Math.max(availW / imgW, availH / imgH);
      return { drawWidth: imgW * scale, drawHeight: imgH * scale };
    }
    case 'stretch':
      return { drawWidth: availW, drawHeight: availH };
    case 'original':
      return { drawWidth: imgW, drawHeight: imgH };
  }
}
```

**Document page appending** (shared for DOCX and TXT):

This is a simplified typesetter. Takes `DocBlock[]` and appends pages to the existing PDFDocument. **Supports per-run formatting** — bold/italic within a paragraph are rendered by measuring and drawing each run segment at advancing X positions.

```typescript
const BLOCK_STYLES = {
  heading1: { fontSize: 24, bold: true, spaceBefore: 18, spaceAfter: 12 },
  heading2: { fontSize: 18, bold: true, spaceBefore: 14, spaceAfter: 10 },
  heading3: { fontSize: 14, bold: true, spaceBefore: 12, spaceAfter: 8 },
  paragraph: { fontSize: 12, bold: false, spaceBefore: 0, spaceAfter: 8 },
  'list-item': { fontSize: 12, bold: false, spaceBefore: 0, spaceAfter: 4 },
};

async function appendDocumentPages(  // ← async for inline image embedding
  pdfDoc: PDFDocument,
  blocks: DocBlock[],
  config: ConvertConfig,
  fonts: { helvetica: PDFFont; helveticaBold: PDFFont; helveticaOblique: PDFFont; helveticaBoldOblique: PDFFont }
) {
  // Use DOCUMENT-specific config fields, with ?? to respect margin=0
  const [pageWidth, pageHeight] = getPageDimensions(config.docPageSize, config.docOrientation);
  const margin = config.margin ?? 36;  // ← ?? not ||, so margin=0 is valid
  const marginTop = margin;
  const marginBottom = margin;
  const marginLeft = margin;
  const marginRight = margin;
  const textWidth = pageWidth - marginLeft - marginRight;

  let page = pdfDoc.addPage([pageWidth, pageHeight]);
  let y = pageHeight - marginTop;

  function newPage() {
    page = pdfDoc.addPage([pageWidth, pageHeight]);
    y = pageHeight - marginTop;
  }

  function getFont(bold: boolean, italic: boolean): PDFFont {
    if (bold && italic) return fonts.helveticaBoldOblique;
    if (bold) return fonts.helveticaBold;
    if (italic) return fonts.helveticaOblique;
    return fonts.helvetica;
  }

  // ── Per-run text layout types (declared once, used per block) ──
  interface StyledWord {
    word: string;
    bold: boolean;
    italic: boolean;
  }
  interface StyledSegment { text: string; font: PDFFont; }
  type StyledLine = StyledSegment[];

  // NOTE: TextRun.underline is captured from DOCX but NOT rendered in v1.
  // pdf-lib has no underline API — it would require manual line drawing per segment.
  // Underline rendering deferred to v2. The data flows through correctly for future use.

  for (const block of blocks) {
    if (block.type === 'image' && block.imageData) {
      // Embed image inline in document flow — embedJpg/embedPng are async!
      const image = block.imageMimeType?.includes('jpeg')
        ? await pdfDoc.embedJpg(block.imageData)    // ← await!
        : await pdfDoc.embedPng(block.imageData);    // ← await!
      const scale = Math.min(1, textWidth / image.width);
      const drawW = image.width * scale;
      const drawH = image.height * scale;
      if (y - drawH < marginBottom) newPage();
      y -= drawH;
      page.drawImage(image, { x: marginLeft, y, width: drawW, height: drawH });
      y -= 8; // spacing after image
      continue;
    }

    const style = BLOCK_STYLES[block.type] || BLOCK_STYLES.paragraph;
    const fontSize = block.type.startsWith('heading') ? style.fontSize : config.textFontSize;
    const lineH = fontSize * config.textLineHeight;

    y -= style.spaceBefore;

    const indent = block.type === 'list-item' ? (block.listLevel || 0) * 20 + 15 : 0;
    const availWidth = textWidth - indent;

    // Draw bullet for list items (before text)
    if (block.type === 'list-item') {
      if (y - lineH < marginBottom) newPage();
      page.drawText('•', {
        x: marginLeft + indent - 12,
        y: y - lineH,
        size: fontSize,
        font: fonts.helvetica,
      });
    }

    // ── Per-run text layout engine ──
    // Instead of flattening all runs into a single string (which loses bold/italic),
    // we build "styled segments" and word-wrap across run boundaries.
    //
    // Algorithm:
    // 1. Split each run into words, carrying the run's style
    // 2. Accumulate words into lines, measuring with the correct font per word
    // 3. When a line exceeds availWidth, emit it and start a new line
    // 4. Draw each line as a sequence of styled segments at advancing X positions

    // Step 1: Build flat list of styled words from all runs
    const styledWords: StyledWord[] = [];
    for (const run of block.runs) {
      const blockBold = style.bold || run.bold;
      const blockItalic = run.italic;
      // Split preserving whitespace boundaries — run.text may contain spaces
      const words = run.text.split(/(\s+)/);
      for (const w of words) {
        if (w.length > 0) {
          styledWords.push({ word: w, bold: blockBold, italic: blockItalic });
        }
      }
    }

    // Step 2: Word-wrap into lines of styled segments
    const lines: StyledLine[] = [];
    let currentLine: StyledLine = [];
    let currentLineWidth = 0;

    for (const sw of styledWords) {
      const font = getFont(sw.bold, sw.italic);
      const wordWidth = font.widthOfTextAtSize(sw.word, fontSize);

      if (currentLineWidth + wordWidth > availWidth && currentLine.length > 0 && sw.word.trim()) {
        lines.push(currentLine);
        currentLine = [];
        currentLineWidth = 0;
      }

      // Merge with last segment if same font (optimization)
      const lastSeg = currentLine[currentLine.length - 1];
      if (lastSeg && lastSeg.font === font) {
        lastSeg.text += sw.word;
      } else {
        currentLine.push({ text: sw.word, font });
      }
      currentLineWidth += wordWidth;
    }
    if (currentLine.length > 0) lines.push(currentLine);

    // Step 3: Draw each line with per-segment fonts
    for (const line of lines) {
      if (y - lineH < marginBottom) newPage();
      y -= lineH;
      let drawX = marginLeft + indent;
      for (const segment of line) {
        page.drawText(segment.text, {
          x: drawX,
          y,
          size: fontSize,
          font: segment.font,
        });
        drawX += segment.font.widthOfTextAtSize(segment.text, fontSize);
      }
    }

    y -= style.spaceAfter;
  }
}
```

**Note on the per-run layout engine**: This preserves bold, italic, and mixed formatting within paragraphs. The previous approach of `block.runs.map(r => r.text).join('')` discarded all inline formatting. The new approach word-wraps across run boundaries and draws each segment with its correct font. The `wrapText()` function from the original spec is no longer used — the wrapping logic is now inline and style-aware.

**Non-Latin text handling**: If any TextRun contains non-Latin characters, detect the script range and load the appropriate Noto Sans variant. See the Noto Sans Font Bundling section below for detection logic and supported scripts.

### Noto Sans Font Bundling (shared by Edit PDF + Convert to PDF)

Both tools need Noto Sans for non-Latin text. This section specifies where fonts come from, what scripts are supported, and how they're loaded.

**Font files** (all in `public/fonts/`, loaded on demand):
| File | Covers | Size |
|------|--------|------|
| `NotoSans-Regular.ttf` | Latin, Cyrillic, Greek | ~550KB |
| `NotoSansArabic-Regular.ttf` | Arabic, Urdu, Persian | ~150KB |
| `NotoSansDevanagari-Regular.ttf` | Hindi, Sanskrit, Marathi | ~200KB |

**⚠ CJK is NOT supported in v1.** Chinese, Japanese, Korean would require NotoSansSC (~8.5MB) — impractical for a static GitHub Pages app. If CJK characters are detected (Unicode ranges `\u4E00-\u9FFF`, `\u3040-\u309F`, `\u30A0-\u30FF`, `\uAC00-\uD7AF`), show error toast: "Chinese, Japanese, and Korean text are not supported yet." Do not attempt to embed — it will produce tofu (□□□).

**Bundling strategy**: Ship fonts as static assets in `public/fonts/`. Load on demand when non-Latin text is detected. Only load the specific font needed for the detected script.

```typescript
// Shared utility: src/lib/fonts.ts

// ⚠ Use import.meta.env.BASE_URL for all asset paths — GitHub Pages serves
// at /repo-name/ so absolute paths like '/fonts/...' miss the prefix.
const FONT_BASE = `${import.meta.env.BASE_URL}fonts/`;

type ScriptFont = 'latin-ext' | 'arabic' | 'devanagari';

const fontCache = new Map<string, Uint8Array>();

const FONT_FILES: Record<ScriptFont, string> = {
  'latin-ext': 'NotoSans-Regular.ttf',
  'arabic': 'NotoSansArabic-Regular.ttf',
  'devanagari': 'NotoSansDevanagari-Regular.ttf',
};

export async function getNotoSansFont(script: ScriptFont): Promise<Uint8Array> {
  const filename = FONT_FILES[script];
  if (!fontCache.has(filename)) {
    const response = await fetch(`${FONT_BASE}${filename}`);
    if (!response.ok) throw new Error(`Failed to load font: ${filename}`);
    fontCache.set(filename, new Uint8Array(await response.arrayBuffer()));
  }
  return fontCache.get(filename)!;
}

// Detect which script(s) are present in text
const CJK_REGEX = /[\u4E00-\u9FFF\u3040-\u309F\u30A0-\u30FF\uAC00-\uD7AF]/;
const ARABIC_REGEX = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/;
const DEVANAGARI_REGEX = /[\u0900-\u097F]/;
const EXTENDED_LATIN_REGEX = /[\u0250-\u024F\u1E00-\u1EFF\u0400-\u04FF\u0370-\u03FF]/; // Cyrillic, Greek, ext. Latin

export function detectRequiredFonts(text: string): { scripts: ScriptFont[]; hasCJK: boolean } {
  const scripts: ScriptFont[] = [];
  const hasCJK = CJK_REGEX.test(text);
  if (ARABIC_REGEX.test(text)) scripts.push('arabic');
  if (DEVANAGARI_REGEX.test(text)) scripts.push('devanagari');
  if (EXTENDED_LATIN_REGEX.test(text)) scripts.push('latin-ext');
  return { scripts, hasCJK };
}

// Usage: Main thread loads needed fonts → passes as Transferable to worker.
// Main thread loads fonts because getNotoSansFont() caches in a module-level Map,
// avoiding duplicate fetches across tools. Worker receives pre-loaded bytes.
// Worker registers fontkit and embeds:
//   pdfDoc.registerFontkit(fontkit);
//   const notoFont = await pdfDoc.embedFont(fontBytes, { subset: true });
```

**Detection and fallback flow**:
1. Before sending to worker, scan all text content with `detectRequiredFonts()`
2. If `hasCJK` is true, show error toast and skip those text items (or replace with placeholder)
3. For each detected script, load font bytes on main thread via `getNotoSansFont(script)`
4. Include all loaded font bytes in the worker message (as Transferables)
5. Worker: register fontkit, embed each font. For each text string, use the appropriate font based on the characters it contains. Fall back to Helvetica for basic Latin.

**Note**: Phase 3 already uses a similar pattern for the watermark tool. Extend the `fonts.ts` utility with the multi-font support above.

### Component: ConvertToPDFTool.tsx

**File input area**: Modified FileDropZone that accepts both images AND documents. Accept: `.jpg,.jpeg,.png,.webp,.gif,.docx,.txt`. Allow multiple files. Max 50 total.

**File list** (main interaction area):
- Vertical list of added files with drag-and-drop reorder
- Each row shows: file type icon (image/document), thumbnail (for images) or file icon (for docs), filename, file size, type badge ("JPG", "DOCX", "TXT"), preprocessing status (spinner while mammoth runs)
- Remove button (×) on each row
- "Add more files" button at bottom
- Visual separator between file entries

**File type indicators**:
- Images: small thumbnail preview rendered via `<img>` with `URL.createObjectURL`
- DOCX: document icon + "DOCX" badge + warning count if mammoth reported warnings (click to expand)
- TXT: text file icon + line count

**Options panel** (sidebar or collapsible — maps directly to `ConvertConfig` fields):

**Document settings** (apply to DOCX/TXT files):
- **Page size** (`docPageSize`): dropdown — A4 (default) | Letter | Legal | A3 | A5
- **Orientation** (`docOrientation`): Portrait (default) | Landscape
- **Font size** (`textFontSize`): slider 8-16, default 12
- **Line spacing** (`textLineHeight`): dropdown — Single (1.0) | 1.15 | 1.5 (default) | Double (2.0)

**Image settings** (apply to image files):
- **Page size** (`imagePageSize`): dropdown — "Fit to image" (default) | A4 | Letter | Legal | A3 | A5
- **Fit mode** (`imageFitMode`): dropdown — "Contain" (default) | "Cover" | "Stretch" | "Original size"
  - Only shown when image page size is NOT "Fit to image"
- **Orientation** (`imageOrientation`): Auto (default) | Portrait | Landscape
  - Auto: uses the image's natural orientation (landscape if wider than tall)

**Shared settings**:
- **Margin** (`margin`): slider 0-72pt (default 36pt)
  - Note: 0 is a valid value — the slider allows it

Show document settings section only when at least one DOCX/TXT file is in the list. Show image settings section only when at least one image file is in the list. This reduces cognitive load.

**Process button**: "Convert to PDF" — disabled until at least 1 file added and all files preprocessed

**Preprocessing indicator**: Files are preprocessed as they're added (mammoth conversion happens immediately). Show a progress state per file: "Processing..." → ✓ Ready. The Convert button only enables when ALL files show "Ready".

**Output filename**: If single file, `{name}.pdf` (replacing extension). If multiple, `converted.pdf`.

### DOCX Limitations Banner

Show when any `.docx` file is added:
> "DOCX conversion works best with text-heavy documents. Complex formatting (columns, text boxes, headers/footers, advanced tables) may not convert accurately. Underline formatting is not preserved."

Dismissible. Show once per session.

### Tests

**Image handling**:
- Single JPEG → PDF: verify 1-page PDF, image embedded
- 3 mixed images (JPG + PNG + WebP) → PDF: verify 3 pages, all embedded
- Contain fit on A4: verify image doesn't exceed page bounds
- Fit-to-image: page dimensions match image + margins
- GIF: verify conversion to PNG before embedding
- Animated GIF: only first frame used
- **Image preprocessing reuse**: verify only one `Image()` object created per file (no double-load)

**Document handling**:
- Simple DOCX with headings + paragraphs → verify text present in output
- DOCX with bold/italic → verify different font variants in output
- **Per-run formatting**: DOCX with "Hello **world** how are you" → verify "world" rendered with HelveticaBold, rest with Helvetica (extract font info from output PDF)
- **Whitespace preservation**: DOCX with "Hello <strong>world</strong> foo" → verify spaces between words are preserved (not merged into "Helloworldfoo")
- **Underline pass-through**: DOCX with `<u>underlined</u>` text → verify TextRun.underline=true is captured but text renders without underline (documented limitation)
- DOCX with embedded image → verify image in output PDF, and verify NO duplicate image block (image should appear once, not twice)
- **Image-in-paragraph**: DOCX where mammoth produces `<p><img .../></p>` → verify single image block, not both paragraph + image
- DOCX with bullet list → verify list items with bullet characters
- TXT file → verify text preserved, paragraphs separated
- Long TXT (1000+ lines) → verify multi-page pagination
- Word-wrap: verify no text overflows margins
- Empty file → show error "This file appears to be empty"

**Config handling**:
- **Margin=0**: set margin to 0 → verify text starts at page edge (no default fallback to 72)
- **Split config**: set docPageSize=letter, imagePageSize=a4 → verify image pages use A4, doc pages use Letter
- **Lazy mammoth**: convert images only → verify mammoth module is NOT loaded (check network/import)
- **CJK error**: TXT file containing Chinese characters → show error toast "Chinese, Japanese, and Korean text are not supported yet", fall back to Helvetica (no crash)
- **Arabic text**: DOCX containing Arabic text → verify NotoSansArabic font loaded and text renders (not tofu)

**Mixed inputs** (the key differentiator):
- JPG + DOCX → verify 1 image page + N document pages in correct order
- TXT + PNG + DOCX → verify pages appear in the order files were arranged
- Reorder: add 3 files (img, docx, txt), reorder to (docx, txt, img) → verify PDF page order matches
- Single TXT file → filename is `{name}.pdf`, not `converted.pdf`

### Edge Cases

- Very large images (>10MB): show file size warning, process anyway
- Animated GIF: only first frame. Show info toast.
- DOCX with tables: convert cells to sequential paragraphs with note: "Table layout simplified to text." Full table rendering deferred to v1.1.
- `.doc` files (old Word format): mammoth does NOT support `.doc`. Show error: "Only .docx files are supported. Please save your document as .docx in Microsoft Word."
- Non-Latin content in DOCX/TXT: detect script via `detectRequiredFonts()`, load appropriate Noto Sans variant on demand. CJK text shows error toast (unsupported in v1).
- DOCX with only images (no text): should produce valid PDF with just images
- Mixed file preprocessing: if mammoth fails on one DOCX, show error on that file but allow other files to proceed (user can remove the failed file and convert the rest)
- 50 file limit: show error when exceeded, don't accept more files
- **Transferable buffers**: verify that image bytes are transferred (not cloned) to the worker — after `postMessage`, the original `Uint8Array` should be detached (zero-length)

---

## Shared: New Error Messages

Add to `src/lib/error-messages.ts`:
```typescript
// Edit PDF
NO_FORM_FIELDS: 'This PDF has no fillable form fields.',
NO_EDITABLE_TEXT: 'No editable text found on this page. The PDF may be image-based.',
EDIT_TEXT_LIMITATION: 'Text editing covers original text with new text. Font matching is approximate.',
UNSAVED_CHANGES: 'You have unsaved edits. Leave without saving?',

// Convert to PDF
NO_FILES_ADDED: 'Please add at least one file.',
IMAGE_LOAD_FAILED: 'Could not load image. The file may be corrupted.',
ANIMATED_GIF_NOTE: 'Animated GIFs: only the first frame will be included.',
MAX_FILES_EXCEEDED: 'Maximum 50 files per conversion.',
EMPTY_DOCUMENT: 'This file appears to be empty.',
DOC_NOT_SUPPORTED: 'Only .docx files are supported. Please save as .docx format.',
DOCX_PARSE_FAILED: 'Could not parse this DOCX file. It may be corrupted.',
DOCX_LAYOUT_NOTE: 'Complex formatting may not convert accurately.',
TABLE_SIMPLIFIED: 'Tables have been simplified to text.',
CJK_NOT_SUPPORTED: 'Chinese, Japanese, and Korean text are not supported yet.',
UNDERLINE_NOT_SUPPORTED: 'Underline formatting is not preserved in DOCX conversion.',
```

---

## New Test Fixtures

Add to `src/__fixtures__/`:
- `with-forms.pdf` — already exists. Verify it has text fields, checkboxes, dropdown, radio group
- `simple-text.pdf` — 2-page PDF with known text at known positions (for Edit Text testing)
- `rotated-page.pdf` — PDF with pages at 0°, 90°, 180°, 270° rotation (for coordinate conversion testing)
- `colored-background.pdf` — PDF with non-white page background (for cover color testing)
- `sample.docx` — simple DOCX with headings, paragraphs, bold/italic mixed in same paragraph, a bullet list, and one embedded image
- `sample.txt` — multi-paragraph plain text file (~500 lines)
- `test-images/` — `photo.jpg` (landscape), `icon.png` (small, square), `graphic.webp`, `animation.gif`

Generate PDF fixtures programmatically (same as existing approach). Non-PDF fixtures can be committed as static files or generated by tests.

---

## Checklist

**Pre-implementation**:
- [ ] Verify `pdfjs-dist` version is 3.4+ (requires `saveDocument()`, `AnnotationStorage`, `AnnotationMode.ENABLE_STORAGE`, `convertToViewportPoint()`). If <3.4, upgrade first.
- [ ] Install `mammoth` dependency
- [ ] Download Noto Sans font files → place in `public/fonts/`:
  - `NotoSans-Regular.ttf` (Latin/Cyrillic/Greek, ~550KB)
  - `NotoSansArabic-Regular.ttf` (Arabic, ~150KB)
  - `NotoSansDevanagari-Regular.ttf` (Devanagari, ~200KB)
- [ ] Add new tool registrations to `src/lib/constants.ts` (2 tools: edit-pdf, convert-to-pdf)
- [ ] Add new error messages to `error-messages.ts`
- [ ] Create `src/stores/editorStore.ts` with the interfaces from PHASE-6.md (EditorState, TextBox, TextEdit, TextStyle, ExtractedTextItem, EditorAction). Use `Record<number, ...>` (not `Map`) for extractedText and pageRotations. Include undo/redo stacks.
- [ ] Create `src/lib/fonts.ts` — shared multi-script Noto Sans loading utility (`getNotoSansFont()`, `detectRequiredFonts()`), uses `import.meta.env.BASE_URL` for asset paths
- [ ] Verify `@pdf-lib/fontkit` already available from Phase 3

**Edit PDF**:
- [ ] Import AnnotationLayer CSS from `pdfjs-dist/web/pdf_viewer.css`
- [ ] PDFEditorCanvas component with 3-layer stack (canvas + form + overlay) with pointer-events toggling per mode
- [ ] Form Fill mode: AnnotationLayer with `ENABLE_STORAGE`, `saveDocument()` for form saving
- [ ] Add Text mode: click-to-place text boxes, drag to reposition, resize handles, bold/italic font selection in worker
- [ ] Edit Text mode: lazy per-page text extraction, cover-and-replace with descender-aware cover rect and configurable cover color
- [ ] Bidirectional coordinate conversion (`screenToPDF` + `pdfToScreen` + `pdfRectToScreen`)
- [ ] Page rotation handling (delegate to viewport methods, cache rotations)
- [ ] Undo/redo system (EditorAction stack, Ctrl+Z / Ctrl+Shift+Z)
- [ ] Toolbar with mode tabs, font/size/color controls, cover color picker (Edit Text mode)
- [ ] Font mapping from PDF.js font names with bold/italic variant detection
- [ ] Two-phase save: `saveDocument()` for forms → worker for text edits + optional flatten
- [ ] Unsaved changes guard on navigation
- [ ] Tests passing for all 3 editing modes, coordinate round-trips, undo/redo

**Convert to PDF**:
- [ ] Modified FileDropZone accepting images + documents
- [ ] File list with type badges, thumbnails, drag-and-drop reorder
- [ ] Main thread preprocessing: single Image() per file, WebP/GIF → PNG, lazy mammoth, TXT → blocks
- [ ] `extractRuns` preserves whitespace between inline elements (no `.trim()` on text nodes)
- [ ] Per-file preprocessing status (spinner → ready)
- [ ] Transferable buffers: extract `Uint8Array` buffers into a `Set<ArrayBuffer>` (prevents duplicates) and pass as Transferables to worker
- [ ] Split ConvertConfig: `docPageSize` + `imagePageSize` (separate settings for images vs documents)
- [ ] Margin uses `??` not `||` to respect `margin=0`
- [ ] All `embedJpg`/`embedPng` calls are `await`ed (they return Promises)
- [ ] Per-run layout engine: word-wrap across run boundaries, preserving bold/italic per segment
- [ ] Non-Latin text detection via `detectRequiredFonts()` and per-script Noto Sans loading. CJK → error toast.
- [ ] Tests passing for images, DOCX, TXT, mixed inputs, per-run formatting, margin=0

**Integration**:
- [ ] Both tools accessible from landing grid with correct category colors (Edit: teal-500, Convert: orange-500)
- [ ] Both tools have `pipelineCompatible: false` and are excluded from pipeline selection
- [ ] Total tool count: 15 (13 original + 2 new)
- [ ] Existing 13 tools regression test — verify nothing broken
- [ ] Full build passes (`npm run build`)
- [ ] All tests pass (`npm run test`)
