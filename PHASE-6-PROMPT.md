Read `docs/PHASE-6.md` fully before writing any code. This is the spec for 2 new tools: **Edit PDF** (Tool 14) and **Convert to PDF** (Tool 15). Phases 1-5 are already complete and working — all 13 existing tools, pipeline system, shared components, worker infrastructure, and deployment are done. Do not modify any existing tool implementations.

## Implementation order

### Step 1: Scaffolding
1. Install `mammoth` (`npm install mammoth --save-exact`)
2. Verify `@pdf-lib/fontkit` is already in package.json from Phase 3
3. Add 2 new tool entries to `src/lib/constants.ts` — `edit-pdf` (category: `edit`, teal-500) and `convert-to-pdf` (category: `convert`, orange-500). Both have `pipelineCompatible: false`. Update the category type union in `src/types/` to include `'edit' | 'convert'`
4. Add all new error messages from PHASE-6.md "Shared: New Error Messages" section to `src/lib/error-messages.ts`
5. Create `src/stores/editorStore.ts` with the interfaces from PHASE-6.md (EditorState, TextBox, TextEdit, TextStyle)
6. Add filename patterns to `src/lib/filename-generator.ts`: edit-pdf → `{name}_edited.pdf`, convert-to-pdf → `converted.pdf` (multi) or `{name}.pdf` (single)
7. Verify landing grid renders 15 tool cards with the 2 new categories showing. Run `npm run build` to confirm no type errors.

### Step 2: Convert to PDF (build this first — simpler, validates worker pattern)
1. Create `src/components/tools/ConvertToPDFTool.tsx`
2. Build the modified FileDropZone that accepts `.jpg,.jpeg,.png,.webp,.gif,.docx,.txt`
3. Implement main-thread preprocessing functions: `preprocessImage`, `preprocessDocx`, `preprocessTxt`, and the HTML parser (`parseHtmlToBlocks`, `extractRuns`)
4. Add the `convert-to-pdf` worker operation to `src/workers/pdf-engine.worker.ts`: `appendImagePages` and `appendDocumentPages` functions with the text layout engine (word-wrap via `font.widthOfTextAtSize`, pagination, heading/list styles, font variant selection)
5. Wire up the component: file list with drag-and-drop reorder, type badges, per-file preprocessing status, options panel (page size, fit mode, margins, font size, line spacing)
6. Write tests — especially the mixed input test (image + DOCX + TXT in one conversion)
7. Run `npm run test` and `npm run build`

### Step 3: Edit PDF (most complex tool in the app)
1. Create `src/components/tools/EditPDFTool.tsx` with the full-width editor layout (NOT the standard split-panel)
2. Build `PDFEditorCanvas.tsx` with the 3-layer stack: Canvas Layer (PDF.js render), Form Layer (PDF.js AnnotationLayer), Edit Overlay Layer
3. Implement Form Fill mode:
   - Render AnnotationLayer for interactive form widgets
   - Build the annotation ID → field name mapping using `page.getAnnotations()`
   - Extract values from DOM form widgets on save
   - Worker: use `pdfDoc.getForm()` to fill fields, optional `form.flatten()`
4. Implement Add Text mode:
   - Click-to-place text boxes on the Edit Overlay Layer
   - Coordinate conversion: `viewport.convertToPdfPoint()` for screen → PDF coords
   - Drag to reposition, corner handles to resize
   - Toolbar: font family, size, color, bold/italic
   - Worker: `page.drawText()` at PDF coordinates with correct font variant
5. Implement Edit Text mode:
   - Extract text with positions via `page.getTextContent()` — use `transform[4]` for x, `viewport.height - transform[5]` for y, `Math.abs(transform[3])` for approximate font size
   - Render clickable highlight regions over extracted text items
   - On click: inline editable input pre-filled with original text
   - Worker: white rectangle (`page.drawRectangle` with `rgb(1,1,1)`) covering original + new text drawn on top
6. Implement Save flow: collect formValues + textBoxes + textEdits → send to worker → standard PreviewPanel + DownloadPanel
7. Add unsaved changes guard (hash change listener + `beforeunload`)
8. Write tests for all 3 modes
9. Run `npm run test` and `npm run build`

### Step 4: Final verification
1. Both tools accessible from landing grid
2. Both excluded from pipeline tool selection
3. Full test suite passes
4. Production build succeeds
5. Manual test: upload a PDF with form fields → fill → add text box → edit existing text → save → verify output

## Critical gotchas (read these before coding)

- **pdf-lib form field names ≠ PDF.js annotation IDs.** AnnotationLayer DOM uses `data-annotation-id` but pdf-lib's `getForm().getField()` uses the field's `/T` name. You MUST build a mapping via `page.getAnnotations()` which has both `id` and `fieldName`. This is the #1 thing that will silently break form filling.
- **PDF coordinate system is bottom-left origin, Y-up.** Screen coordinates are top-left origin, Y-down. Use `viewport.convertToPdfPoint(screenX, screenY)` for conversion. Test at multiple zoom levels.
- **pdf-lib only embeds JPG and PNG.** WebP and GIF must be converted to PNG via `canvas.toBlob('image/png')` on the main thread BEFORE transferring to the worker.
- **mammoth.js needs DOMParser** — it MUST run on the main thread, not in the worker. Only the layout engine (word-wrap + page creation) runs in the worker. Send pre-parsed `DocBlock[]` to the worker.
- **mammoth does NOT support `.doc` files** (only `.docx`). Reject `.doc` with a clear error message.
- **Text edit is cover-and-replace** — draw white rect + new text. Show the limitation banner on first use of Edit Text mode.
- **Non-Latin text**: detect via `/[^\u0000-\u024F]/` regex. If found, use `@pdf-lib/fontkit` + Noto Sans instead of StandardFonts.Helvetica. This pattern already exists in the Phase 3 watermark/page-numbers tools — reuse it.
- **Animated GIFs**: `canvas.drawImage` only captures the first frame. Show an info toast.
- **All existing tool implementations, worker operations, and shared components are working. Do not refactor them.** Only add new code.
