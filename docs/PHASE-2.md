# Quire — Phase 2: Core Tools

Read SPEC.md for architecture and interfaces. Phase 1 must be complete. This phase implements the 6 core "Organize" tools plus Rotate.

For each tool: implement the worker operation in `pdf-engine.worker.ts`, implement the React component, write integration tests.

---

## Worker Operation Pattern

Every tool follows this pattern in the worker:

```typescript
operations['toolname'] = async (pdfBytesArray, options, onProgress, isCancelled) => {
  const pdfDoc = await PDFDocument.load(pdfBytesArray[0]);
  // ... page-by-page processing with:
  // onProgress({ step: 'Processing', current: i, total: totalPages });
  // if (isCancelled()) return null;  // Check between pages
  const outputBytes = await outputDoc.save();
  return { files: [{ name: 'output.pdf', bytes: outputBytes }] };
};
```

---

## Tool 1: Split PDF

### Worker Operation: `split`
- Receives: single PDF bytes + `{ mode: 'single' | 'separate', ranges: number[][] }`
- `single` mode: create one new PDFDocument, copyPages for all selected pages
- `separate` mode: create one PDFDocument per range, copyPages for each range
- Progress: report per-range for separate mode
- Cancel check: between ranges

### Component: SplitTool.tsx
- PageSelector with BatchSelectionBar (Select All, Even, Odd, Invert)
- Split mode toggle: "Extract selected as one PDF" | "Split into separate PDFs"
- For separate mode: text input for defining ranges (e.g., "1-3, 4-7, 8-end" → 3 PDFs)
- Process button: disabled until pages selected
- Output: PreviewPanel + DownloadPanel (ZIP for multiple files)
- Filenames: `{name}_pages_{range}.pdf`

### Tests
- Split 3-page PDF into pages 1-2 and page 3 → verify 2 output files with correct page counts
- Split with "end" keyword
- Single mode: extract pages 2-3 → verify 1 output with 2 pages

---

## Tool 2: Merge PDFs

### Worker Operation: `merge`
- Receives: multiple PDF bytes arrays + `{ order: number[] }` (file indices in desired order)
- Create new PDFDocument, iterate files in specified order, copyPages from each
- Progress: report per-file
- Cancel check: between files

### Component: MergeTool.tsx
- **File-level merge only for v1** (page-level merge deferred to v1.1)
- FileDropZone configured for multiple files (min 2)
- File list with drag-and-drop reordering (@dnd-kit/sortable)
  - Each item: file name, page count, drag handle, remove button
  - Keyboard alternative: select with Space, move with arrow keys, confirm with Enter
- "Add more files" button below the list
- Total page count display
- Process button: disabled until 2+ files loaded
- Output: single merged PDF
- Filename: `merged_{N}_files.pdf`

### Tests
- Merge 2 PDFs (3 pages + 2 pages) → verify output has 5 pages
- Merge with reordered files → verify page order matches

---

## Tool 3: Rotate Pages

### Worker Operation: `rotate`
- Receives: single PDF bytes + `{ rotations: Record<number, number> }` (pageIndex → degrees)
- Load PDF, apply `page.setRotation(degrees(value))` for each specified page
- Progress: report per-page
- Cancel check: between pages

### Component: RotateTool.tsx
- ThumbnailGrid with rotation interaction:
  - Click a thumbnail → cycle rotation: 0° → 90° → 180° → 270° → 0°
  - Rotation indicator on each thumbnail: small arrow icon showing current rotation (NOT just color)
- Bulk action buttons above grid:
  - "Rotate All 90° CW" | "Rotate All 90° CCW" | "Rotate All 180°"
  - "Rotate Even Pages 90° CW" | "Rotate Odd Pages 90° CW"
- BatchSelectionBar: select pages, then apply rotation to selection
- Reset button to revert all rotations
- PreviewPanel with "Show Original" toggle
- Filename: `{name}_rotated.pdf`

### Tests
- Rotate all pages 90° → verify each page's rotation value
- Rotate only even pages → verify even pages rotated, odd unchanged
- Rotate page 1 by 270° → verify

---

## Tool 4: Reorder Pages

### Worker Operation: `reorder`
- Receives: single PDF bytes + `{ newOrder: number[] }` (array of original page indices in new order)
- Create new PDFDocument, copyPages in specified order
- Progress: single step (fast operation)

### Component: ReorderTool.tsx
- ThumbnailGrid with drag-and-drop sortable (@dnd-kit)
  - Each thumbnail shows page number overlay
  - Drag handle visible on hover
  - Ghost element at 0.6 opacity during drag
  - Keyboard alternative: select → arrow keys → Enter
- "Reset Order" button
- Process button
- Filename: `{name}_reordered.pdf`

### Tests
- Reorder 3-page PDF to [3, 1, 2] → verify output page order

---

## Tool 5: Delete Pages

### Worker Operation: `delete`
- Receives: single PDF bytes + `{ pagesToDelete: number[] }`
- Create new PDFDocument, copyPages for all pages NOT in delete set
- Validate: cannot delete all pages

### Component: DeletePagesTool.tsx
- PageSelector with BatchSelectionBar
- Selected pages shown with red overlay + trash icon (not just color — accessibility)
- Confirmation text: "Delete X of Y pages?"
- Process button: disabled if 0 selected or all selected. If all selected, show inline message: "Cannot delete all pages"
- Reset button
- Filename: `{name}_{N}_pages_removed.pdf`

### Tests
- Delete page 2 from 3-page PDF → verify output has 2 pages and correct content
- Attempt to delete all pages → verify error/prevention

---

## Tool 6: Extract Pages

### Worker Operation: `extract`
- Same as split internally — reuses split operation with mode parameter
- Receives: single PDF bytes + `{ pages: number[], mode: 'single' | 'individual' }`
- `single`: all selected pages into one PDF
- `individual`: each selected page as separate PDF

### Component: ExtractPagesTool.tsx
- PageSelector with BatchSelectionBar
- Output mode toggle: "As single PDF" | "Each page as separate PDF"
- Process button
- For individual mode: ZIP download with list of individual files
- Filenames: `{name}_extracted.pdf` or `{name}_page_{N}.pdf`

### Tests
- Extract pages 1, 3 from 3-page PDF as single → verify 2-page output
- Extract pages 1, 2, 3 as individual → verify 3 separate 1-page PDFs

---

## Shared Patterns for This Phase

### Time Estimation
Each tool implements `estimateTime(pageCount, fileSize)`:
- Split/Extract/Delete: ~0.5s + 0.01s per page
- Merge: ~0.5s + 0.02s per page per file
- Rotate: ~0.3s + 0.005s per page (just setting a property)
- Reorder: ~0.5s + 0.01s per page

These are rough estimates — better to underpromise. Show in PreviewPanel before processing.

### ToolSuggestions Integration
After file upload in any tool, run `pdf-analyzer.ts`:
- If encrypted → show suggestion banner: "This PDF is password-protected. Try Unlock PDF first." with link
- If 50+ pages → "Large document. Consider Split PDF to extract what you need."
- Dismissable with X button. Max one suggestion at a time.

---

## Definition of Done for Phase 2

- [ ] All 6 tools work end-to-end: upload → configure → process → preview → download
- [ ] Cancel button stops processing mid-operation
- [ ] Progress bar shows page-level progress for each tool
- [ ] Output file size displayed in PreviewPanel
- [ ] Processing time estimate shown before processing, actual time after
- [ ] "Process another file" button resets tool cleanly
- [ ] "Show Original" toggle works for Rotate
- [ ] Smart filenames on all downloads
- [ ] Merge drag-and-drop reordering works with keyboard alternative
- [ ] ToolSuggestions appear for encrypted and large PDFs
- [ ] All tools handle edge cases: encrypted PDF (prompt), corrupt PDF (error toast), 0-page PDF (error)
- [ ] Integration tests pass for all 6 tools
- [ ] Keyboard shortcuts work within tools (Ctrl+A, Escape, Ctrl+Z reset)
