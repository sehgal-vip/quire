# Quire — Phase 1: Foundation

Read SPEC.md first for architecture, design system, and state management details. This phase builds all infrastructure and shared components.

---

## Step 1: Project Setup

1. `npm create vite@latest quire -- --template react-ts`
2. Install all dependencies from SPEC.md (pin exact versions for pdf-lib-with-encrypt and pdfjs-dist)
3. Configure `vite.config.ts`:
   - `base: '/quire/'` (for GitHub Pages — adjust to your repo name)
   - Configure `vite-plugin-pwa` for service worker
   - Configure web worker support (Vite handles `.worker.ts` files natively)
4. Configure Tailwind CSS v3 (`tailwind.config.js` — NOT v4 CSS-native)
5. Add Inter font from Google Fonts in `index.html`
6. Add inline CSS loading indicator in `index.html` `<body>` (CSS-only spinner inside `<div id="root">`, gets replaced when React mounts). This prevents blank white screen on slow connections.
7. Set up Vitest config (`vitest.config.ts`)
8. Set up ESLint (flat config) + Prettier. Consistent formatting across Claude Code sessions.
9. Set up path aliases (`@/` → `src/`)

## Step 2: Types

Create `src/types/index.ts` with all interfaces from SPEC.md:
- `PDFTool`, `ToolProps`, `ToolOutput`, `OutputFile`
- `CachedFile`, `UploadedFile`
- `WorkerRequest`, `WorkerCancel`, `WorkerResponse`
- `ValidationResult`, `PipelinePreset`
- `ThumbnailState` (loading | rendered | failed)

## Step 3: Zustand Stores

Create the three stores from SPEC.md:
- `src/stores/appStore.ts` — navigation, current tool, pipeline mode
- `src/stores/fileStore.ts` — file cache (max 5), current files
- `src/stores/processingStore.ts` — processing status, progress, result, cancel

Integrate hash-based routing in `appStore`: when `setView('tool', 'split')` is called, update `window.location.hash` to `#split`. On app load, read hash and restore view. Listen for `hashchange` events.

## Step 4: Layout Components

### Header.tsx
- "Quire" wordmark on the left (text-2xl font-bold, indigo-600)
- "?" icon button on the right (opens KeyboardShortcutsHelp)
- Slim, max-height 56px, white background, subtle bottom border

### Footer.tsx
- Single line, centered, text-secondary, 12px
- Lock icon + "Your files never leave your browser. All processing happens locally."
- No background color — just text at the bottom

### Layout.tsx
- Max-width 1200px container, centered
- Header at top, Footer at bottom, main content area in between
- Manages `beforeunload` listener: warn when `processingStore.status === 'processing'`

## Step 5: Landing Page (Tool Grid)

### Mode Toggle
- Top of grid area: segmented control "Single Tool" | "Pipeline"
- "Single Tool" auto-selected by default
- Toggling updates `appStore.pipelineMode`

### Tool Grid
- Responsive CSS grid: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4`
- Category headers: H2 style from design system, with category color dot
- Each tool card:
  - White background, 12px radius, shadow-sm, 20px padding
  - Thin left border in category color (4px, rounded)
  - Lucide icon (24px, category color) + tool name (H3) + description (small, text-secondary)
  - Hover: translateY(-2px), shadow-md, 150ms transition
  - In Single mode: click navigates to tool (`appStore.setView('tool', toolId)`)
  - In Pipeline mode: click adds/removes tool from pipeline selection. Show numbered badge on selected cards. Max 5 tools in pipeline.
- Implement the tool registry in `src/lib/constants.ts` — array of all 13 tool definitions (without component/process implementations yet — those come in Phase 2-3). Tools without implementations show "Coming soon" when clicked.

### Pipeline Presets (visible only in Pipeline mode)
- Show above tool grid
- 3-4 preset cards from SPEC.md pipeline-presets
- Clicking a preset auto-selects those tools in sequence

## Step 6: View Switching

- `App.tsx` reads `appStore.currentView` and renders the appropriate view
- Grid view → Tool interface → back to grid
- Focus management: when entering tool view, focus moves to tool heading
- Back button (top-left of tool view) or `Escape` key returns to grid
- Hash updates on every view change

## Step 7: Web Worker Setup

### `src/workers/pdf-engine.worker.ts`
- Import `pdf-lib-with-encrypt`
- Listen for messages matching `WorkerRequest` interface
- Maintain a `Set<string>` of cancelled request IDs
- On cancel message: add ID to cancelled set
- Stub out operation handlers (will be implemented per tool in Phase 2-3):
  ```typescript
  const operations: Record<string, (bytes: ArrayBuffer[], options: any, onProgress: Function, isCancelled: Function) => Promise<WorkerResult>> = {};
  ```
- Each operation receives an `isCancelled` callback to check between page iterations
- Send progress messages back to main thread during page-by-page operations

### `src/lib/pdf-worker-client.ts`
- Create worker instance
- `process()`: sends request, returns Promise, listens for result/error/cancelled
- `cancel()`: sends cancel message
- `onProgress()`: registers callback for progress updates
- Updates `processingStore` directly via `useProcessingStore.getState()`

## Step 8: FileDropZone Component

- Large dashed border area (min 200px tall, full width)
- Upload cloud icon (Lucide) centered + "Drop your PDF here or click to browse"
- States: idle → drag-over (indigo border + bg-indigo-50) → loading → loaded → error
- On file load:
  - Validate magic bytes (`%PDF-`)
  - Show file name, size (formatted), page count
  - Add to `fileStore.recentFiles` cache
  - Memory warning: use `navigator.deviceMemory` if available. If file > 50% of device memory (or >50MB fallback), show yellow warning
  - If encrypted (detect via pdf-lib load error), show inline password input
- **Recent files section**: if `fileStore.recentFiles` has entries, show below drop zone. Clickable cards with file name, page count, time since upload. Clicking loads from cache.
- For merge tool: accept multiple files, show file list with remove buttons
- Accessibility: focusable via Tab, activate via Enter/Space, `aria-label="Upload PDF file"`
- Animate transitions between states (150ms)

## Step 9: Thumbnail Renderer + Render Queue

### `src/lib/render-queue.ts`
- Queue class with max concurrency of 3
- Methods: `enqueue(pageIndex, priority)`, `cancel(pageIndex)`, `cancelAll()`
- Priority levels: HIGH (visible), LOW (not visible)
- Uses IntersectionObserver results to set priority
- When a thumbnail scrolls into view → set HIGH priority, move to front of queue
- When a thumbnail scrolls out → cancel if still pending
- On render failure → return `{ status: 'failed', pageIndex }` instead of throwing

### `src/lib/thumbnail-renderer.ts`
- Load PDF via `pdfjs.getDocument()`
- Render a single page to canvas at 0.5x scale
- Return canvas as data URL or ImageBitmap
- Wrap in try/catch — on failure, return null (ThumbnailGrid shows placeholder)

### ThumbnailGrid.tsx
- CSS Grid: `auto-fill, minmax(150px, 1fr)`
- Each cell: canvas thumbnail OR skeleton (gray rect + page number) OR error placeholder (gray rect + page number + warning icon)
- IntersectionObserver on each cell → feeds render queue
- Page number overlay at bottom
- State overlays: selected (blue border + checkmark), deletion (red overlay + trash icon), rotation (arrow icon)
- Keyboard navigation: arrow keys move focus, Space toggles selection, Home/End jump
- **DragSelectOverlay**: mousedown on empty space starts rectangle selection. All thumbnails intersecting the rectangle become selected. `useDragSelect` hook tracks mouse events and calculates intersection with thumbnail bounding rects.

## Step 10: BatchSelectionBar

- Horizontal bar above thumbnail grid
- Buttons: "Select All" | "Even" | "Odd" | "Invert" | "Clear"
- Shows: "X of Y pages selected"
- Compact: small buttons, horizontal row, all keyboard accessible

## Step 11: PageSelector (synced dual-input)

- Top: text input for range (e.g., "1-3, 5, 8-end")
- Below: BatchSelectionBar
- Below that: ThumbnailGrid with selection + drag-select
- Syncing logic:
  - Text input change (debounced 300ms) → parse → update thumbnail selection
  - Thumbnail click → update text input
  - Drag-select → update text input
  - Batch button → update both
- Show error if range is invalid

### `src/lib/page-range-parser.ts`
- Parse: "1", "1-5", "1,3,5", "1-3, 5, 8-12", "1-3,5,8-end"
- Handle spaces, "end" keyword, validate against total page count
- Return: `{ pages: number[], error?: string }`
- **Write thorough unit tests** for this module

## Step 12: ProgressBar

- Thin 4px bar at top of tool area
- Subscribes to `processingStore.progress`
- Determinate mode when iterating pages (width = current/total * 100%)
- Indeterminate mode (animated pulse) for loading/saving steps
- Status text below: "Loading PDF...", "Processing page 5 of 20...", "Saving..."
- **Cancel button**: appears next to progress text during processing. Calls `processingStore.cancel()` → worker client sends cancel message
- On completion: green flash + checkmark for 2 seconds
- `role="progressbar"` with proper ARIA attributes

## Step 13: PreviewPanel

- Shows after processing completes
- First page thumbnail of output + total page count + **output file size** (formatted)
- **"Show Original" toggle**: button that switches preview between processed output and original. Available for: rotate, watermark, page numbers, scale. Single view, not side-by-side.
- **Processing time estimate**: before processing, show "Estimated time: ~X seconds" based on `tool.estimateTime(pageCount, fileSize)`. After processing, show actual time taken.
- For multi-file output: list with file names, page counts, individual thumbnails

## Step 14: DownloadPanel

- Single file: "Download" primary button
- Multi-file: "Download All as ZIP" + individual "Download" buttons per file
- **"Process another file" button**: resets tool to empty/upload state (calls `onReset`, clears `processingStore`)
- Uses `file-saver` for downloads, `jszip` for ZIP creation
- Smart filenames from `filename-generator.ts`

## Step 15: EmptyState

- Shown in each tool before file upload
- Minimal: tool name, brief description
- 3-step guide: Upload icon + "Upload your PDF" → Sliders icon + "Configure options" → Download icon + "Preview & download"
- One line per step, muted text, small icons
- Below: the FileDropZone

## Step 16: KeyboardShortcutsHelp

- Modal/overlay triggered by "?" key or header icon
- Lists all shortcuts from SPEC.md in a clean table
- Close with Escape or click outside

## Step 17: Error Boundaries

- Wrap each tool component in a React error boundary
- On error: show friendly message + "Go back to tools" button
- Log error to console for debugging

## Step 18: Toast Notification Setup

- Configure `react-hot-toast` with position top-right, 4s duration
- Custom styling to match design system
- `role="alert"` for accessibility

## Step 19: Service Worker

- Configure `vite-plugin-pwa` in vite config
- Precache all build output
- Runtime cache PDF.js worker CDN URL
- Show subtle "Available offline" text in footer after SW activates

---

## Definition of Done for Phase 1

- [ ] Landing page renders with all 13 tool cards organized by category with color-coded borders
- [ ] Mode toggle switches between Single and Pipeline modes
- [ ] Clicking a tool card in Single mode navigates to tool view with back button
- [ ] Hash-based URLs work (#split, #merge, etc.) including on page refresh
- [ ] FileDropZone accepts PDFs, validates magic bytes, shows file info, memory warnings
- [ ] Recent files appear after uploading and persist across tool switches
- [ ] Encrypted PDF detection shows inline password prompt
- [ ] ThumbnailGrid renders page thumbnails with lazy loading and render queue
- [ ] Failed thumbnail renders show placeholder (not crash)
- [ ] PageSelector syncs between text input, thumbnail clicks, drag-select, and batch buttons
- [ ] Page range parser handles all documented formats with unit tests passing
- [ ] ProgressBar shows determinate/indeterminate progress with cancel button
- [ ] Web Worker sends and receives messages correctly (test with a stub operation)
- [ ] Keyboard shortcuts work (Escape, Ctrl+A, ?)
- [ ] beforeunload warning fires during processing
- [ ] All components are keyboard accessible with visible focus indicators
- [ ] Service worker caches assets and app works offline
- [ ] Vitest runs and page-range-parser tests pass
