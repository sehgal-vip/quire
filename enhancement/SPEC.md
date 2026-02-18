# Quire — Master Specification

## Project Overview

Build **Quire**, a fully client-side, static PDF manipulation web app. Zero backend — all processing happens in the browser. Hosted on GitHub Pages. Users upload PDFs, pick a tool (or chain up to 5 tools in a pipeline), and download the result. No data ever leaves the browser.

---

## Tech Stack

- **React 18+** with **Vite** (latest stable)
- **Tailwind CSS v3** for styling (NOT v4 — use `tailwind.config.js`, not CSS-native config)
- **TypeScript** throughout (strict mode)
- **Zustand** for state management
- **ESLint** (flat config) + **Prettier** for code consistency
- Hash-based routing for tool URLs (`#split`, `#merge`, etc.)

### Core Dependencies

Pin exact versions for critical libraries (no caret ranges).

```
pdf-lib-with-encrypt — Drop-in replacement for pdf-lib WITH encryption support (MIT license). Use this instead of pdf-lib. PIN EXACT VERSION.
@pdf-lib/fontkit     — Custom font embedding for Unicode support in watermarks/page numbers
pdfjs-dist           — Rendering page thumbnails and previews via canvas. PIN TO 4.x.
zustand              — Lightweight state management (~2KB)
jszip                — Bundling multi-file outputs into ZIP downloads
file-saver           — Clean cross-browser file download triggers
@dnd-kit/core        — Drag-and-drop for reorder and merge interfaces
@dnd-kit/sortable    — Sortable lists for page reordering
lucide-react         — Icon set (lightweight, tree-shakeable)
react-hot-toast      — Toast notifications for errors and success
vite-plugin-pwa      — Service worker generation via Workbox
vitest               — Unit and integration testing
@testing-library/react — Component testing
mammoth              — DOCX to HTML conversion (for DOCX → PDF)
```

IMPORTANT: Use `pdf-lib-with-encrypt` NOT `pdf-lib`. It's API-compatible but adds encryption support (AES-128, RC4-128, user/owner passwords, permission flags). Import from `pdf-lib-with-encrypt` everywhere.

NOTE: `pdf-lib-with-encrypt` is a community fork (1 maintainer, ~1.5K weekly downloads). If it becomes unmaintained, fallback options: (a) `pdf-lib-plus-encrypt` — similar fork, (b) standard `pdf-lib` + `@pdfsmaller/pdf-encrypt-lite` as a separate encryption layer for Encrypt/Unlock only.

---

## State Management (Zustand)

Three Zustand stores:

### 1. `useAppStore` — Navigation & UI state
```typescript
interface AppStore {
  currentView: 'grid' | 'tool' | 'pipeline';
  currentToolId: string | null;
  pipelineMode: boolean;
  setView: (view: AppStore['currentView'], toolId?: string) => void;
  togglePipelineMode: () => void;
}
```

### 2. `useFileStore` — File cache & current files
```typescript
interface FileStore {
  recentFiles: CachedFile[];      // Max 5, in-memory only
  currentFiles: UploadedFile[];   // Currently loaded in active tool
  addToCache: (file: CachedFile) => void;
  setCurrentFiles: (files: UploadedFile[]) => void;
  clearCurrentFiles: () => void;
}

interface CachedFile {
  id: string;
  name: string;
  bytes: Uint8Array;
  pageCount: number;
  cachedAt: number;
  isEncrypted: boolean;
}

interface UploadedFile {
  id: string;
  name: string;
  bytes: Uint8Array;
  pageCount: number;
  fileSize: number;
  isEncrypted: boolean;
  password?: string;      // if user provided password for encrypted PDF
}

interface ToolOutput {
  files: OutputFile[];
  processingTime: number; // milliseconds
}

interface OutputFile {
  name: string;
  bytes: Uint8Array;
  pageCount: number;
}
```

### 3. `useProcessingStore` — Processing state (updated by Web Worker)
```typescript
interface ProcessingStore {
  status: 'idle' | 'processing' | 'done' | 'error' | 'cancelled';
  progress: { step: string; current: number; total: number } | null;
  result: ToolOutput | null;
  error: string | null;
  estimatedTime: number | null;   // seconds
  startProcessing: () => void;
  updateProgress: (progress: ProcessingStore['progress']) => void;
  setResult: (result: ToolOutput) => void;
  setError: (error: string) => void;
  cancel: () => void;
  reset: () => void;
}
```

Why Zustand: Web Worker callbacks need to update progress state from outside the React tree. Zustand allows `useProcessingStore.getState().updateProgress(...)` from plain JS modules. No providers needed. Selective subscriptions prevent unnecessary re-renders.

---

## Web Worker Architecture [CRITICAL]

ALL pdf-lib-with-encrypt operations run in a Web Worker. The main thread NEVER imports pdf-lib-with-encrypt directly.

```
Main Thread (React UI + Zustand stores)
  ↕ postMessage with Transferable ArrayBuffers
Worker Thread (pdf-engine.worker.ts)
  - Imports pdf-lib-with-encrypt
  - Receives: operation name + PDF bytes + options
  - Returns: processed PDF bytes + progress updates
  - Checks for cancellation between page iterations
```

### Worker Message Protocol
```typescript
// Main → Worker
interface WorkerRequest {
  id: string;
  operation: string;     // "split", "merge", "rotate", etc.
  pdfBytes: ArrayBuffer[];
  options: Record<string, any>;
}

// Main → Worker (cancel)
interface WorkerCancel {
  id: string;
  type: 'cancel';
}

// Worker → Main
interface WorkerResponse {
  id: string;
  type: 'progress' | 'result' | 'error' | 'cancelled';
  progress?: { step: string; current: number; total: number };
  result?: { files: { name: string; bytes: ArrayBuffer }[] };
  error?: string;
}
```

### Cancel Support
The worker maintains a `cancelled` Set of request IDs. When processing page-by-page operations, it checks `if (cancelled.has(id)) return { id, type: 'cancelled' }` between each page. The main thread sends a cancel message, and the worker stops at the next check point.

### Worker Client (`src/lib/pdf-worker-client.ts`)
Promise-based wrapper over postMessage:
```typescript
class PDFWorkerClient {
  process(operation: string, pdfBytes: Uint8Array[], options: Record<string, any>): Promise<WorkerResult>;
  cancel(requestId: string): void;
  onProgress(requestId: string, callback: (progress) => void): void;
}
```
Transfer ArrayBuffers as Transferable to avoid memory copying.

**IMPORTANT: Transferable ownership.** When an ArrayBuffer is transferred, the sender loses access (it becomes zero-length). The worker client must clone bytes before transferring if the main thread still needs them (e.g., for thumbnail rendering). Pattern: `const transferCopy = new Uint8Array(original).buffer;` then transfer the copy.

### Worker Error Handling
The worker client must handle unexpected worker death (OOM crashes, unhandled exceptions):
```typescript
worker.onerror = (error) => {
  useProcessingStore.getState().setError(
    'Processing failed — this file may be too large for your browser. Try a smaller file or close other tabs.'
  );
};
```
Also maintain a Set of pending request IDs. On cancel, remove from pending. Ignore any WorkerResponse whose ID is not in the pending set (prevents stale responses from rapid Process → Cancel → Process sequences).

---

## Plugin-Based Tool System

Each tool conforms to a standard interface:

```typescript
interface PDFTool {
  id: string;
  name: string;
  description: string;
  icon: string;                    // Lucide icon name
  category: 'organize' | 'transform' | 'stamp' | 'security' | 'info' | 'edit' | 'convert';
  categoryColor: string;           // Tailwind color class for category indicator
  acceptsMultipleFiles: boolean;
  pipelineCompatible: boolean;     // false for Merge, Edit PDF, Convert to PDF
  component: React.ComponentType<ToolProps>;
  estimateTime: (pageCount: number, fileSize: number) => number; // seconds
  generateFilename: (originalName: string, options: any) => string;
  validateInPipeline?: (position: number, pipeline: string[]) => ValidationResult;
}

interface ToolProps {
  files: UploadedFile[];
  onProcess: (options: any) => Promise<void>;
  onResult: (result: ToolOutput) => void;
  onError: (error: string) => void;
  onReset: () => void;
}
```

### Tool Registry (15 tools)
**Organize** (blue-500): Split, Merge, Reorder, Delete Pages, Extract Pages, Add Blank Pages
**Transform** (amber-500): Rotate, Scale/Resize
**Stamp** (purple-500): Add Page Numbers, Add Text Watermark
**Security** (red-500): Encrypt (Password Protect), Unlock PDF
**Info** (green-500): Edit Metadata
**Edit** (teal-500): Edit PDF (form fill, add text, edit text)
**Convert** (orange-500): Convert to PDF (images, DOCX, TXT — any mix)

Category colors appear as a thin left border or small dot on each tool card.

---

## Thumbnail Render Queue [CRITICAL]

`src/lib/render-queue.ts` — prevents browser crashes on large PDFs:

- Max **3-4 concurrent** canvas renders
- **IntersectionObserver** detects visible thumbnails
- **Prioritize** currently visible thumbnails
- **Cancel** pending renders for thumbnails that scroll out of viewport
- **Re-queue** thumbnails that scroll back into view
- **Failure fallback**: if PDF.js fails to render a page (complex vectors, broken fonts, corrupt stream), show a gray placeholder with page number + warning icon. Never crash.

---

## Smart Output Filenames

`src/lib/filename-generator.ts`:
- Base on original filename (strip `.pdf`, re-add at end)
- Split: `{name}_pages_{range}.pdf`
- Merge: `merged_{N}_files.pdf`
- Reorder: `{name}_reordered.pdf`
- Delete: `{name}_{N}_pages_removed.pdf`
- Extract: `{name}_extracted.pdf` or `{name}_page_{N}.pdf`
- Blank pages: `{name}_with_blanks.pdf`
- Rotate: `{name}_rotated.pdf`
- Scale: `{name}_resized_{target}.pdf`
- Page numbers: `{name}_numbered.pdf`
- Watermark: `{name}_watermarked.pdf`
- Encrypt: `{name}_encrypted.pdf`
- Unlock: `{name}_unlocked.pdf`
- Metadata: `{name}_edited.pdf`
- Edit PDF: `{name}_edited.pdf`
- Convert to PDF: `converted.pdf` (mixed inputs) or `{name}.pdf` (single input, replacing extension)
- Pipeline: use last operation's suffix
- Sanitize: remove special chars, limit 200 chars

---

## Keyboard Shortcuts

| Shortcut | Action | Context |
|----------|--------|---------|
| `Escape` | Go back to tool grid | Tool interface |
| `Ctrl/Cmd+A` | Select all pages | PageSelector visible |
| `Ctrl/Cmd+Shift+A` | Deselect all | PageSelector visible |
| `Ctrl/Cmd+Z` | Reset tool to original state | Tool interface |
| `Ctrl/Cmd+S` | Download result (prevent browser save) | After processing |
| `?` | Show keyboard shortcuts overlay | Anywhere |

Disable shortcuts when text input is focused.

---

## Design System

### Colors
- Background: #FFFFFF | Surface: #F9FAFB | Cards: white
- Primary: Indigo #4F46E5 | Primary hover: #4338CA
- Success: #10B981 | Warning: #F59E0B | Error: #EF4444
- Text primary: #111827 | Text secondary: #6B7280 | Borders: #E5E7EB
- Category colors: Organize blue-500, Transform amber-500, Stamp purple-500, Security red-500, Info green-500, Edit teal-500, Convert orange-500

### Typography
- Font: Inter (Google Fonts) + system fallback
- H1: 28px bold | H2: 18px semibold uppercase tracking-wide | H3: 16px medium
- Body: 14px | Small: 12px text-secondary

### Layout
- Max width: 1200px centered | Grid gap: 16px | Card padding: 20px
- Card radius: 12px | shadow-sm default, shadow-md hover
- Tool interface max-width: 900px centered

### Interactions
- Card hover: translateY(-2px) + shadow increase, 150ms
- Buttons: rounded-lg, transition-all 150ms
- Drag ghost: 0.6 opacity | Toasts: top-right, 4s auto-dismiss
- `beforeunload` warning during active processing

### Responsive
- Desktop (default): full grid | Tablet (<1024px): 2-col | Mobile (<640px): 1-col
- Desktop-first. Gentle note on mobile for complex tools suggesting desktop.

### Accessibility [CRITICAL]
- All interactive elements: visible 2px indigo focus ring
- All buttons/controls: descriptive `aria-label`
- Thumbnail grid: keyboard navigable (arrows, Space select, Enter activate)
- Drag-and-drop: keyboard alternative (select → arrow keys → Enter confirm)
- Color NEVER sole state indicator — always paired with icon/text
- Focus managed on view transitions
- Progress bar: `role="progressbar"` with proper ARIA
- All form inputs: associated labels
- Toasts: `role="alert"`

---

## Testing Strategy

### Framework: Vitest + @testing-library/react

### Unit Tests (required for all lib/ modules)
- `page-range-parser.ts` — extensive: "1", "1-5", "1,3,5", "1-3, 5, 8-end", invalid inputs, edge cases
- `filename-generator.ts` — all 15 tool name patterns, sanitization, length limits
- `pipeline-validator.ts` — all 5 validation rules, edge cases
- `render-queue.ts` — queue ordering, cancellation, re-queue logic
- `pdf-analyzer.ts` — detection of encryption, page count thresholds

### Integration Tests (per tool)
- Each tool: load a test PDF → configure options → process → verify output is a valid PDF (check magic bytes, page count, that it loads without error in pdf-lib)
- Encrypt tool: verify output requires password to open
- Unlock tool: verify output opens without password
- Merge: verify output page count = sum of input page counts
- Split: verify output page counts match expected ranges
- Rotate: verify page rotation values in output
- Edit PDF: verify form fill values, text box coordinates, text edit cover-and-replace
- Convert to PDF: verify mixed inputs (images + DOCX + TXT) produce correct multi-section PDF

### Test PDF Fixtures (`src/__fixtures__/`)
- `simple.pdf` — 3-page basic PDF
- `large.pdf` — 20+ pages with mixed content
- `encrypted.pdf` — password-protected (password: "test123")
- `mixed-sizes.pdf` — pages with different dimensions (A4, Letter, landscape)
- `empty.pdf` — 0 pages (edge case)
- `corrupt.pdf` — truncated/malformed file
- `with-forms.pdf` — contains form fields (text, checkbox, dropdown, radio)
- `simple-text.pdf` — 2-page PDF with known text at known positions (for Edit Text)
- `sample.docx` — DOCX with headings, paragraphs, bold/italic, bullet list, embedded image
- `sample.txt` — multi-paragraph plain text (~500 lines)
- `test-images/` — `photo.jpg`, `icon.png`, `graphic.webp`, `animation.gif`

Generate these fixtures programmatically using pdf-lib-with-encrypt in a setup script.

---

## Known Limitations (document in UI where relevant)

- **`copyPages()` drops annotations**: pdf-lib's copyPages transfers page content but silently drops annotations, form fields, JavaScript actions, embedded files, and bookmarks. Affects Split, Merge, Reorder, Delete, Extract. Show subtle warning in these tools: "Note: Annotations and form fields may not be preserved."
- **Latin-only standard fonts**: `StandardFonts.Helvetica` only supports Latin-1 characters. Page Numbers and Watermark tools using standard fonts will produce missing characters for Chinese, Arabic, Hindi, etc. Mitigation: use `@pdf-lib/fontkit` with a bundled Unicode font (Noto Sans subset, ~300KB) when non-Latin input is detected. At minimum, validate input and show warning.
- **Scale/Resize fragility**: Content stream manipulation is unreliable across complex PDFs. Use Form XObject approach (wrap original page content as XObject, draw scaled onto new page) rather than raw content stream matrix injection.
- **Merge not pipeline-compatible**: Merge requires multiple file inputs. Pipeline feeds single file between steps. Merge has `pipelineCompatible: false` and is excluded from pipeline tool selection.
- **Text editing is cover-and-replace**: Editing existing PDF text works by drawing a white rectangle over the original and placing new text on top. Font matching is approximate, paragraph reflow doesn't work, and complex layouts (tables, multi-column) will break. Best for simple edits (fixing typos, changing names). Document this clearly in UI.
- **DOCX conversion has layout limits**: mammoth.js extracts DOCX content as HTML. Complex Word features (columns, text boxes, advanced tables, headers/footers, embedded objects) will degrade or be lost. Simple text-heavy documents convert well.

---

## Error Messages (`src/lib/error-messages.ts`)

Centralized error strings for consistency:
```typescript
export const ERRORS = {
  INVALID_PDF: 'This file is not a valid PDF.',
  ENCRYPTED_NEEDS_PASSWORD: 'This PDF is password-protected. Please enter the password.',
  WRONG_PASSWORD: 'Incorrect password. Please try again.',
  FILE_TOO_LARGE: 'This file may be too large for your browser. Try a smaller file or close other tabs.',
  WORKER_CRASHED: 'Processing failed unexpectedly. Try again with a smaller file.',
  OPERATION_CANCELLED: 'Operation cancelled.',
  CANNOT_DELETE_ALL: 'Cannot delete all pages. At least one page must remain.',
  MERGE_MIN_FILES: 'Merge requires at least 2 PDF files.',
  NON_LATIN_WARNING: 'Your text contains non-Latin characters. These may not display correctly with the standard font.',
  ANNOTATIONS_WARNING: 'Note: Annotations and form fields may not be preserved.',
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
} as const;
```

---

## Directory Structure

```
src/
├── components/
│   ├── layout/
│   │   ├── Header.tsx
│   │   ├── Footer.tsx
│   │   └── Layout.tsx
│   ├── common/
│   │   ├── FileDropZone.tsx
│   │   ├── ThumbnailGrid.tsx
│   │   ├── PageSelector.tsx
│   │   ├── BatchSelectionBar.tsx
│   │   ├── DragSelectOverlay.tsx
│   │   ├── ProgressBar.tsx
│   │   ├── PreviewPanel.tsx
│   │   ├── DownloadPanel.tsx
│   │   ├── PipelineBuilder.tsx
│   │   ├── PipelinePresets.tsx
│   │   ├── ToolSuggestions.tsx
│   │   ├── EmptyState.tsx
│   │   └── KeyboardShortcutsHelp.tsx
│   └── tools/
│       ├── SplitTool.tsx
│       ├── MergeTool.tsx
│       ├── ReorderTool.tsx
│       ├── DeletePagesTool.tsx
│       ├── ExtractPagesTool.tsx
│       ├── AddBlankPagesTool.tsx
│       ├── RotateTool.tsx
│       ├── ScaleResizeTool.tsx
│       ├── PageNumbersTool.tsx
│       ├── TextWatermarkTool.tsx
│       ├── EncryptTool.tsx
│       ├── UnlockTool.tsx
│       ├── MetadataEditorTool.tsx
│       ├── EditPDFTool.tsx
│       └── ConvertToPDFTool.tsx
├── workers/
│   └── pdf-engine.worker.ts
├── stores/
│   ├── appStore.ts
│   ├── fileStore.ts
│   ├── processingStore.ts
│   └── editorStore.ts          # Phase 6: Edit PDF state (undo/redo, extracted text, page rotations)
├── lib/
│   ├── pdf-worker-client.ts
│   ├── thumbnail-renderer.ts
│   ├── render-queue.ts
│   ├── page-range-parser.ts
│   ├── pipeline-validator.ts
│   ├── pipeline-presets.ts
│   ├── pdf-analyzer.ts
│   ├── filename-generator.ts
│   ├── download-utils.ts
│   ├── time-estimator.ts
│   ├── error-messages.ts
│   ├── fonts.ts                # Phase 6: Multi-script Noto Sans loading (Latin/Cyrillic/Greek + Arabic + Devanagari), script detection
│   ├── keyboard-shortcuts.ts
│   └── constants.ts
├── hooks/
│   ├── useFileUpload.ts
│   ├── useThumbnails.ts
│   ├── useProcessing.ts
│   ├── usePipeline.ts
│   ├── useDragSelect.ts
│   └── useKeyboardShortcuts.ts
├── types/
│   └── index.ts
├── __fixtures__/
│   └── generate-fixtures.ts
├── __tests__/
│   ├── lib/
│   └── tools/
├── App.tsx
├── main.tsx
├── sw.ts
└── index.css
```

---

## Service Worker

Use `vite-plugin-pwa` with Workbox:
- Precache: all Vite build output, PDF.js worker file, Inter font
- Runtime cache: CDN resources
- Strategy: cache-first for static assets
- Fully functional offline after first visit
- Subtle "Available offline" indicator after SW activates
