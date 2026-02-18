Read `docs/PHASE-6.md` fully before writing any code. This is the spec for 2 new tools: **Edit PDF** (Tool 14) and **Convert to PDF** (Tool 15). Phases 1-5 are already complete and working — all 13 existing tools, pipeline system, shared components, worker infrastructure, and deployment are done. Do not modify any existing tool implementations.

## Implementation order

### Step 1: Scaffolding
1. **Verify `pdfjs-dist` version is 3.4+** — this phase requires `saveDocument()`, `AnnotationStorage`, `AnnotationMode.ENABLE_STORAGE`, and `convertToViewportPoint()`. If current version is <3.4, upgrade before proceeding.
2. Install `mammoth` (`npm install mammoth --save-exact`)
3. Verify `@pdf-lib/fontkit` is already in package.json from Phase 3
4. Download Noto Sans font files from Google Fonts → place in `public/fonts/`:
   - `NotoSans-Regular.ttf` (Latin/Cyrillic/Greek, ~550KB)
   - `NotoSansArabic-Regular.ttf` (Arabic, ~150KB)
   - `NotoSansDevanagari-Regular.ttf` (Devanagari, ~200KB)
5. Add 2 new tool entries to `src/lib/constants.ts` — `edit-pdf` (category: `edit`, teal-500) and `convert-to-pdf` (category: `convert`, orange-500). Both have `pipelineCompatible: false`. Update the category type union in `src/types/` to include `'edit' | 'convert'`
6. Add all new error messages from PHASE-6.md "Shared: New Error Messages" section to `src/lib/error-messages.ts` (includes CJK_NOT_SUPPORTED and UNDERLINE_NOT_SUPPORTED)
7. Create `src/stores/editorStore.ts` with the interfaces from PHASE-6.md (EditorState, TextBox, TextEdit, TextStyle, ExtractedTextItem, EditorAction). **Use `Record<number, ...>` for `extractedText` and `pageRotations` — NOT `Map`.** Maps break with Zustand devtools/persist middleware because `JSON.stringify(new Map())` returns `"{}"`. Include undo/redo stacks.
8. Create `src/lib/fonts.ts` — multi-script Noto Sans loading utility with `getNotoSansFont(script)` and `detectRequiredFonts(text)`. **CRITICAL: Use `${import.meta.env.BASE_URL}fonts/...` for all asset paths** — GitHub Pages serves at `/repo-name/` so absolute paths like `/fonts/...` miss the prefix.
9. Add filename patterns to `src/lib/filename-generator.ts`: edit-pdf → `{name}_edited.pdf`, convert-to-pdf → `converted.pdf` (multi) or `{name}.pdf` (single)
10. Verify landing grid renders 15 tool cards with the 2 new categories showing. Run `npm run build` to confirm no type errors.

### Step 2: Convert to PDF (build this first — simpler, validates worker pattern)
1. Create `src/components/tools/ConvertToPDFTool.tsx`
2. Build the modified FileDropZone that accepts `.jpg,.jpeg,.png,.webp,.gif,.docx,.txt`
3. Implement main-thread preprocessing functions:
   - `preprocessImage`: Load image ONCE (single `new Image()`), read dimensions, convert WebP/GIF → PNG using same loaded Image. Do NOT create a second Image object.
   - `preprocessDocx`: Lazy-load mammoth via `await import('mammoth')` — do NOT import at module level (saves ~230KB for image-only conversions)
   - `preprocessTxt`: Split on blank lines, convert to DocBlock[]
   - HTML parser (`parseHtmlToBlocks`, `extractRuns`):
     - **CRITICAL — do NOT use `.trim()` on text nodes in `extractRuns`.** Trimming strips boundary whitespace between inline elements, merging "Hello **world** foo" into "Helloworldfoo". Only skip completely empty (length 0) text nodes.
     - **CRITICAL — check for images BEFORE paragraph processing.** Mammoth may wrap `<img>` inside `<p>`. If the image check runs after/outside the if-else chain, you get both a paragraph block AND an image block (image appears twice in output).
     - `underline: boolean` is captured in TextRun from `<U>` tags but NOT rendered in v1 (pdf-lib has no underline API). Keep the data flowing for future use — add a `// TODO: underline rendering deferred to v2` comment.
4. Add the `convert-to-pdf` worker operation to `src/workers/pdf-engine.worker.ts`:
   - Use **split ConvertConfig**: `docPageSize` + `docOrientation` for documents, `imagePageSize` + `imageOrientation` + `imageFitMode` for images. One shared `margin` field.
   - **CRITICAL: `await` all `embedJpg`/`embedPng` calls** — they return Promises. Both `appendImagePages` and `appendDocumentPages` must be `async` functions.
   - **CRITICAL: Use `config.margin ?? 36` not `config.margin || 72`** — the `||` operator treats margin=0 as falsy and defaults to 72. Use `??` (nullish coalescing) everywhere margin is used.
   - **Per-run layout engine**: Do NOT flatten all runs into a single string. Declare `StyledWord`, `StyledSegment`, `StyledLine` interfaces ONCE before the block loop (not inside it). Build styled word segments from each run, word-wrap across run boundaries, and draw each segment with its correct font (bold/italic preserved). See PHASE-6.md for the full algorithm.
   - **Non-Latin text**: Use `detectRequiredFonts()` from `fonts.ts`. Load per-script Noto Sans variants. CJK → show error toast, do not attempt embed.
5. **Transferable buffers**: When sending preprocessed files to the worker, extract all `Uint8Array.buffer` values into a **`Set<ArrayBuffer>`** (not an array — prevents `DataCloneError` if two Uint8Arrays share the same underlying buffer) and pass as Transferables in `postMessage`.
6. Wire up the component: file list with drag-and-drop reorder, type badges, per-file preprocessing status, options panel matching ConvertConfig fields (document settings section + image settings section + shared margin). `textLineHeight` default is **1.5**. Show each section only when relevant files are present.
7. Write tests — especially: mixed input test, per-run formatting test ("Hello **world**" preserves bold), margin=0 test, whitespace preservation test, image-in-paragraph dedup test, CJK error toast test
8. Run `npm run test` and `npm run build`

### Step 3: Edit PDF (most complex tool in the app)
1. **Import AnnotationLayer CSS**: `import 'pdfjs-dist/web/pdf_viewer.css'` (or extract `.annotationLayer` rules ~2KB). Without this, form widgets stack in the top-left corner.
2. Create `src/components/tools/EditPDFTool.tsx` with the full-width editor layout (NOT the standard split-panel)
3. Build `PDFEditorCanvas.tsx` with the 3-layer stack: Canvas Layer (PDF.js render), Form Layer (PDF.js AnnotationLayer), Edit Overlay Layer. **Implement pointer-events toggling**: Form Fill mode → Form Layer active, overlay disabled. Add Text / Edit Text → overlay active, Form Layer disabled. This prevents accidental form field focus while dragging text boxes.
4. Implement **bidirectional coordinate conversion** (both directions needed):
   - `screenToPDF()`: uses `viewport.convertToPdfPoint()` — for capturing user clicks
   - `pdfToScreen()`: uses `viewport.convertToViewportPoint()` — for rendering text boxes/highlights in the overlay
   - `pdfRectToScreen()`: converts a PDF-space rectangle to screen-space {left, top, width, height}
   - Both functions handle page rotation automatically via viewport. Cache page rotations on load in `editorStore.pageRotations[pageIndex]`.
   - **CRITICAL RULE**: All stored coordinates (TextBox, TextEdit, ExtractedTextItem) are in PDF space (points, bottom-left origin, unscaled). Screen conversion happens ONLY at render time.
5. Implement Form Fill mode:
   - Render AnnotationLayer with `AnnotationMode.ENABLE_STORAGE` and pass `pdfDoc.annotationStorage`
   - **Use `pdfDocProxy.saveDocument()` to save filled forms** — do NOT scrape DOM values or build annotation ID → field name mappings. PDF.js handles this internally.
   - If user also made text edits, pass `saveDocument()` output to worker for text overlays
   - Optional flatten: worker loads saveDocument output with pdf-lib, calls `form.flatten()`
6. Implement Add Text mode:
   - Click-to-place text boxes on the Edit Overlay Layer
   - Store in PDF coordinates via `screenToPDF()`, render via `pdfToScreen()` + `pdfRectToScreen()`
   - Re-render all overlays when zoom changes
   - Drag to reposition, corner handles to resize
   - Toolbar: font family, size, color, bold/italic
   - **Worker: use `getStandardFont(family, bold, italic)` to select the correct font variant.** The previous code only looked at fontFamily and always selected regular weight — bold/italic toggles were cosmetic-only. All 12 standard font variants must be selectable.
7. Implement Edit Text mode:
   - **Lazy per-page extraction**: Call `page.getTextContent()` only for the CURRENT page when user navigates to it in Edit Text mode. Cache in `editorStore.extractedText[pageIndex]`. Do NOT extract all pages on load — a 200-page PDF would stall for 5-10 seconds.
   - `getTextContent()` returns ALL values in PDF user-space units (points). **There is no viewport dependency** — `item.width` and `transform` values are always in points regardless of any viewport you create. No scale division needed.
   - Store raw PDF coordinates: `x = transform[4]`, `y = transform[5]` (**do NOT flip Y** — keep raw PDF Y, bottom-left origin)
   - Render highlights using `pdfRectToScreen()` to convert to overlay positions
   - **Cover rectangle must account for descenders.** Text baseline is at `transform[5]`, but letters like g, p, q, y extend ~25% below baseline. Cover rect Y should be `y - height * 0.25 - 1`, cover height should be `height * 1.25 + 2`.
   - **Cover color**: Add a cover color picker to toolbar (defaults to `#FFFFFF`). Store in `TextEdit.coverColor`. On PDFs with non-white backgrounds, the white rectangle is glaringly visible.
   - **Font mapping**: Use `mapPDFJsFontToStandard()` with the ORIGINAL `fontName` from extracted text item (e.g., "Helvetica-Bold"), NOT the user's style.fontFamily. Function detects bold/italic/oblique variants for better matching.
   - Worker: draw cover rectangle with user-selected color + new text on top
8. Implement **undo/redo**:
   - Push `EditorAction` to `undoStack` on every edit (add/move/resize/delete text box, add/remove text edit)
   - Ctrl+Z: pop from undoStack, reverse, push to redoStack
   - Ctrl+Shift+Z: pop from redoStack, re-apply, push to undoStack
   - Clear redoStack on any new edit action
   - Undo/Redo buttons in toolbar, enabled when stack has entries
9. Implement **two-phase save flow**: `saveDocument()` for forms (main thread) → worker for text edits + flatten
10. Add unsaved changes guard (hash change listener + `beforeunload`)
11. Write tests for all 3 modes + coordinate round-trips at multiple zoom levels + rotated pages + undo/redo + bold/italic in Add Text + descender coverage + lazy extraction + pointer-events isolation
12. Run `npm run test` and `npm run build`

### Step 4: Final verification
1. Both tools accessible from landing grid
2. Both excluded from pipeline tool selection
3. Full test suite passes (including existing 13 tools — regression check)
4. Production build succeeds
5. Manual test: upload a PDF with form fields → fill → add text box (bold) → edit existing text → undo the text edit → redo → save → verify output has bold text box and edited text with correct cover color

## Critical gotchas (read these before coding)

1. **PDF.js version must be 3.4+.** `saveDocument()`, `AnnotationStorage`, `AnnotationMode.ENABLE_STORAGE`, and `convertToViewportPoint()` don't exist in older versions. Check version before starting.

2. **Form fill: use `saveDocument()`, NOT DOM scraping.** PDF.js `AnnotationStorage` + `pdfDocProxy.saveDocument()` produces a PDF with filled form data. Do NOT build annotation ID → field name mappings — `data-annotation-id` doesn't reliably map to pdf-lib's `/T` field names. This is the #1 source of bugs in PDF form tools.

3. **AnnotationLayer needs CSS.** Import `pdfjs-dist/web/pdf_viewer.css` or form widgets render in the wrong position.

4. **Layer pointer-events must toggle per mode.** Form Fill → Form Layer active, Edit Overlay disabled. Add Text / Edit Text → Edit Overlay active, Form Layer disabled. Otherwise dragging text boxes accidentally focuses form fields underneath.

5. **Edit Text coordinates: store raw PDF Y, do NOT flip.** `transform[5]` is already in PDF space (bottom-left origin). Do NOT convert to screen Y for storage — that produces viewport-scaled values that break in the worker. Store raw, convert only at render time.

6. **`getTextContent()` width is already in PDF points.** There is NO viewport dependency. `item.width` and `transform` values are always in user-space units regardless of any viewport. Do not create a viewport for extraction or divide width by scale — it's unnecessary.

7. **Lazy text extraction — per page, not all pages.** Only call `getTextContent()` for the current page when user navigates to it in Edit Text mode. Cache results. Extracting all pages on load stalls for 5-10 seconds on large PDFs.

8. **Add Text worker MUST handle bold/italic.** Use `getStandardFont(family, bold, italic)` to select among all 12 standard font variants. The previous implementation only used fontFamily and always returned the regular weight — bold/italic toggles were cosmetic-only.

9. **Cover rectangle must cover descenders.** Text at `transform[5]` is the baseline. Letters like g, p, y extend ~25% below. Use `y - height * 0.25 - 1` for cover Y, `height * 1.25 + 2` for cover height.

10. **Bidirectional coordinates required.** You need BOTH `screenToPDF()` (clicks) AND `pdfToScreen()` (rendering overlays). Use `viewport.convertToPdfPoint()` and `viewport.convertToViewportPoint()` — both handle rotation automatically.

11. **`embedJpg()` and `embedPng()` are async.** They return Promises. `appendImagePages` and `appendDocumentPages` must be `async` and must `await` these calls. Missing `await` silently produces broken output.

12. **`margin || 72` treats 0 as falsy.** Use `config.margin ?? 36` everywhere. Margin of 0 is a valid user choice.

13. **`extractRuns` must NOT trim text nodes.** `.trim()` strips boundary whitespace, merging "Hello **world** foo" → "Helloworldfoo". Only skip completely empty text nodes.

14. **HTML parser: check images BEFORE paragraphs.** Mammoth wraps `<img>` in `<p>`. If image detection runs outside the if-else chain, `<p><img/></p>` creates both a paragraph block and an image block — image appears twice in output.

15. **Per-run formatting matters.** Do NOT flatten runs into one string — this discards bold/italic. Declare `StyledWord`/`StyledSegment`/`StyledLine` interfaces ONCE before the block loop (not inside it). Build styled word segments, word-wrap across run boundaries, draw each segment with its font.

16. **Lazy-load mammoth.** `import mammoth from 'mammoth'` at module level wastes ~230KB for image-only conversions. Use `await import('mammoth')` on first .docx file.

17. **Transferable buffers: use a Set.** Extract `Uint8Array.buffer` values into a `Set<ArrayBuffer>` (not an array). If two Uint8Arrays share the same underlying ArrayBuffer, pushing both causes `DataCloneError: ArrayBuffer at index N is already in the transfer list`.

18. **Cover-and-replace on non-white backgrounds.** White rectangle is visible on colored backgrounds. Offer a cover color picker defaulting to `#FFFFFF`.

19. **pdf-lib only embeds JPG and PNG.** WebP and GIF must be converted to PNG via `canvas.toBlob('image/png')` on the main thread BEFORE transferring to the worker.

20. **mammoth.js needs DOMParser** — it MUST run on the main thread, not in the worker. Only the layout engine runs in the worker. Send pre-parsed `DocBlock[]`.

21. **mammoth does NOT support `.doc`** (only `.docx`). Reject with clear error.

22. **Noto Sans: three font files, NOT one.** NotoSans-Regular.ttf only covers Latin/Cyrillic/Greek. Arabic and Devanagari need separate font files. CJK is NOT supported in v1 (~8.5MB font is impractical). Use `detectRequiredFonts()` to identify scripts and load only what's needed.

23. **GitHub Pages base path.** ALL asset fetches (fonts, worker URLs) must use `${import.meta.env.BASE_URL}` — NOT absolute paths like `/fonts/...`. Absolute paths resolve to the domain root, missing the `/repo-name/` prefix.

24. **Zustand store: use Record, not Map.** `extractedText` and `pageRotations` must be `Record<number, ...>`, not `Map`. Maps break with devtools/persist middleware because `JSON.stringify(new Map())` returns `"{}"`.

25. **Underline: captured but not rendered.** `TextRun.underline` is detected from `<U>` tags and stored in the data model, but the layout engine does not render underlines in v1. Document this in the DOCX limitations banner.

26. **All existing tool implementations, worker operations, and shared components are working. Do not refactor them.** Only add new code.
