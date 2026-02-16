# Quire — Phase 5: Polish & Deploy

Read SPEC.md for design system and quality bar. Phases 1-4 must be complete. This phase handles polish, testing, deployment, and final quality checks.

---

## 1. ToolSuggestions Component

### `src/lib/pdf-analyzer.ts`
Analyze PDF properties after upload:
```typescript
interface PDFAnalysis {
  isEncrypted: boolean;
  pageCount: number;
  hasFormFields: boolean;
  hasMixedPageSizes: boolean;
  fileSize: number;
}
```

Load PDF with pdf-lib-with-encrypt (in worker) and extract properties. Handle load failures gracefully.

### ToolSuggestions.tsx
- Dismissable banner/card shown after PDF upload, above tool controls
- Priority rules (show only the highest priority match):
  1. Encrypted → yellow banner: "This PDF is password-protected. Try Unlock PDF first." + button to switch tool
  2. 50+ pages → subtle hint: "Large document ({N} pages). Split PDF can help extract what you need."
  3. Mixed page sizes → info: "This PDF has mixed page sizes. Page Numbers and Watermark will adapt to each page."
- Dismissable with X button
- Does not block tool interface

---

## 2. Processing Time Estimates

### `src/lib/time-estimator.ts`

Each tool has an `estimateTime` function based on page count and file size:

```typescript
const estimates: Record<string, (pages: number, sizeBytes: number) => number> = {
  'split': (p) => 0.5 + p * 0.01,
  'merge': (p) => 0.5 + p * 0.02,
  'rotate': (p) => 0.3 + p * 0.005,
  'reorder': (p) => 0.5 + p * 0.01,
  'delete-pages': (p) => 0.5 + p * 0.01,
  'extract-pages': (p) => 0.5 + p * 0.01,
  'add-blank-pages': () => 0.5,
  'add-page-numbers': (p) => 1 + p * 0.05,
  'text-watermark': (p) => 1 + p * 0.05,
  'scale': (p) => 1 + p * 0.03,
  'encrypt': (p) => 0.5 + p * 0.02,
  'unlock': () => 0.5,
  'edit-metadata': () => 0.3,
};
```

- Show "Estimated time: ~X seconds" in PreviewPanel before user clicks Process
- After processing, show "Completed in X.Xs"
- Store start time in processingStore, calculate on completion

---

## 3. Output File Size Display

After processing completes, show in PreviewPanel:
- File size formatted: "Output: 2.3 MB" (or KB for small files)
- If output is smaller than input: show green text "↓ 15% smaller than original"
- If output is larger: show neutral text with size
- For multi-file outputs: show individual sizes + total

---

## 4. "Process Another File" Button

In every tool's DownloadPanel, after processing:
- Secondary button: "Process Another File"
- On click: calls `onReset()` → clears processingStore → resets tool to empty/upload state
- The file cache still retains the original file in `fileStore.recentFiles`

---

## 5. Category Color Coding on Tool Grid

Each tool card has a thin left border (4px) in its category color:
- **Organize**: `border-l-blue-500`
- **Transform**: `border-l-amber-500`
- **Stamp**: `border-l-purple-500`
- **Security**: `border-l-red-500`
- **Info**: `border-l-green-500`

Category headers also get a small colored dot before the text.

---

## 6. `beforeunload` Warning

In `Layout.tsx`, add effect:
```typescript
useEffect(() => {
  const handler = (e: BeforeUnloadEvent) => {
    if (useProcessingStore.getState().status === 'processing') {
      e.preventDefault();
      e.returnValue = '';
    }
  };
  window.addEventListener('beforeunload', handler);
  return () => window.removeEventListener('beforeunload', handler);
}, []);
```

Also warn if pipeline is mid-execution.

---

## 7. Hash-Based Tool URLs (verify/polish)

Ensure from Phase 1:
- Navigating to `#split` opens the Split tool directly
- Bookmarkable: refreshing the page on `#merge` reopens Merge tool
- Back button works: browser back from tool → grid
- Unknown hashes fall back to grid view
- Pipeline mode: `#pipeline` shows pipeline builder

---

## 8. GitHub Actions Deployment

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npm run build
      - uses: actions/upload-pages-artifact@v3
        with:
          path: dist

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - uses: actions/deploy-pages@v4
        id: deployment
```

Also:
- Add `404.html` in `public/` that's a copy of `index.html` (for SPA hash routing)
- Verify `vite.config.ts` has correct `base` path for the repo

---

## 9. Accessibility Audit

Go through every component and verify:

### Focus Management
- [ ] Tab order is logical in every view
- [ ] No focus traps (except modals, which trap correctly and release on close)
- [ ] View transitions move focus to appropriate element (tool heading, first input)
- [ ] Modal (keyboard shortcuts) traps focus and releases on Escape

### Visual Indicators
- [ ] Every interactive element has visible focus ring (2px indigo)
- [ ] Color is never the only state indicator:
  - Selected thumbnails: blue border AND checkmark icon
  - Deleted thumbnails: red overlay AND trash icon
  - Rotated thumbnails: arrow icon (not just rotated appearance)
  - Pipeline step status: color AND icon (check/X/dash)
  - Password strength: color bar AND text label (weak/medium/strong)

### ARIA
- [ ] All buttons have `aria-label` when icon-only
- [ ] Progress bar has `role="progressbar"` + `aria-valuenow/min/max`
- [ ] Toasts have `role="alert"`
- [ ] Thumbnail grid has `role="grid"` with `role="gridcell"` children
- [ ] Form inputs have associated `<label>` elements
- [ ] Live regions announce processing completion

### Keyboard
- [ ] Every action reachable by keyboard
- [ ] Shortcuts work and don't conflict with text inputs (disabled when input focused)
- [ ] Drag-and-drop has keyboard alternative everywhere it's used
- [ ] Escape closes modals and returns to grid

---

## 10. Performance Testing

Test with real-world scenarios:

### Test Cases
1. **100-page PDF, split**: Verify thumbnails load without freezing, processing completes, progress bar is smooth
2. **100MB PDF, merge**: Verify memory warning appears, processing completes without crash
3. **500-page PDF, rotate all**: Verify cancel works mid-operation, progress updates per-page
4. **5-step pipeline, 50-page PDF**: Verify all steps complete, memory doesn't balloon, intermediate cleanup works
5. **Rapid scroll on 100-page thumbnail grid**: Verify render queue handles it without browser hang
6. **Multiple sequential operations**: Upload → process → download → "Process another" → upload again → process. Verify no memory leaks.

### Browser Testing
- [ ] Chrome (primary)
- [ ] Firefox
- [ ] Safari
- [ ] Edge
- Verify output PDFs open correctly in each browser's built-in viewer

### Mobile Spot-Check
- [ ] Grid is responsive and usable on mobile
- [ ] Simple tools (rotate, metadata) work on mobile
- [ ] Complex tools show "best on desktop" note

---

## 11. Final Quality Checklist

- [ ] All 13 tools work end-to-end
- [ ] Pipeline with presets works end-to-end
- [ ] No console errors or warnings in normal operation
- [ ] All downloads have smart filenames
- [ ] Output file sizes displayed
- [ ] Processing time estimates shown
- [ ] "Process another file" works in every tool
- [ ] Cancel works during every operation
- [ ] Encrypted PDFs detected and handled in every tool
- [ ] Corrupt PDFs show error toast, don't crash
- [ ] All keyboard shortcuts functional
- [ ] beforeunload warning fires during processing
- [ ] App works offline after first visit
- [ ] Hash URLs bookmarkable and work on refresh
- [ ] GitHub Pages deployment succeeds
- [ ] Privacy footer visible on every view
- [ ] Accessibility audit items all checked
- [ ] All Vitest tests passing

---

## Future Backlog (v1.1+)

Items explicitly deferred:
- **Page-level merge mode**: show thumbnails from all files in one unified draggable grid (needs virtualization + dnd-kit conflict resolution)
- **PDF to image export** (PDF.js render → canvas → PNG/JPG)
- **Image to PDF** (embed images via pdf-lib)
- **Basic compression** (strip unused objects, downscale images)
- **OCR** (Tesseract.js — slow but functional)
- **Dark mode**
- **Analytics** (Plausible/Umami)
- **Individual tool routes** with SEO meta tags (migrate from hash to real routing)
