# Quire — Phase 3: Remaining Tools

Read SPEC.md for architecture. Phases 1-2 must be complete. This phase implements the remaining 7 tools.

---

## Tool 7: Add Blank Pages

### Worker Operation: `add-blank-pages`
- Receives: PDF bytes + `{ position: 'before' | 'after' | 'beginning' | 'end', targetPage: number, count: number, width: number, height: number }`
- Create new PDFDocument, copyPages, insert blank pages at specified position using `pdfDoc.addPage([width, height])`
- For "match page X": read that page's dimensions

### Component: AddBlankPagesTool.tsx
- Position selector: dropdown "At beginning" | "At end" | "Before page X" | "After page X"
- For "Before/After page X": number input for target page
- Number of blank pages: number input (default 1, min 1, max 100)
- Page size: dropdown "Match page [X]" (default) | A4 | Letter | Legal | A3 | A5 | Custom
- For Custom: width + height inputs with unit toggle (mm, in, pt)
- ThumbnailGrid showing current pages with insertion point indicator
- Filename: `{name}_with_blanks.pdf`

### Tests
- Insert 1 blank page at end → verify page count +1
- Insert 2 blank pages before page 2 → verify page count +2 and position

---

## Tool 8: Add Page Numbers

### Worker Operation: `add-page-numbers`
- Receives: PDF bytes + `{ position, format, startNumber, fontSize, color, margin, pageRange }`
- Load PDF, iterate pages in range
- For each page: get that page's individual dimensions, calculate text position, embedFont(StandardFonts.Helvetica), page.drawText() at calculated coordinates
- **Unicode support**: if text contains non-Latin characters (detect via regex), use `@pdf-lib/fontkit` with a bundled Noto Sans subset instead of Helvetica. Validate input and warn if standard font can't render it.
- Handle mixed page sizes: always calculate position per-page
- Progress: per-page with cancel check

### Component: PageNumbersTool.tsx
- **Position**: 3x3 grid selector (visual grid of 9 clickable cells: top-left through bottom-right). Bottom-center selected by default. Highlight selected cell.
- **Format**: dropdown — "1", "Page 1", "Page 1 of N", "1/N", "i, ii, iii" (roman numerals)
- **Starting number**: number input (default 1)
- **Font size**: slider (8-36pt, default 12)
- **Color**: color picker input (default #000000)
- **Margin from edge**: slider (20-100pt, default 40)
- **Apply to**: radio — "All pages" | "Page range" (shows text input)
- **Live preview**: render first page thumbnail with page number overlay on a canvas. Update preview on any option change (debounced 200ms). This preview is rendered client-side on canvas — do NOT call the worker for preview. Draw the text on a canvas overlay above the thumbnail.
- PreviewPanel with "Show Original" toggle
- Filename: `{name}_numbered.pdf`

### Tests
- Add page numbers to 3-page PDF, format "Page 1 of 3" → verify text drawn on each page
- Starting number 5 → verify first page shows "Page 5"
- Apply to range "2-3" only → verify page 1 has no number

---

## Tool 9: Add Text Watermark

### Worker Operation: `add-watermark`
- Receives: PDF bytes + `{ text, fontSize, angle, opacity, color, mode, pageRange }`
- Load PDF, iterate pages in range
- For each page: set graphics state for opacity (using `setGraphicsState` with `ca`/`CA` properties), calculate center position, drawText with rotation
- For "Tile" mode: calculate grid positions based on text width and page size, draw at each position
- Handle mixed page sizes
- Progress: per-page with cancel check

### Component: TextWatermarkTool.tsx
- **Watermark text**: text input (default "CONFIDENTIAL")
- **Font size**: slider (20-120pt, default 60)
- **Rotation angle**: slider (-90° to 90°, default 45°)
- **Opacity**: slider (0.05 to 1.0, default 0.15) — show percentage
- **Color**: color picker (default #808080 gray)
- **Mode**: toggle — "Center" (default) | "Tile" (repeat across page)
- **Apply to**: radio — "All pages" | "Page range" (text input)
- **Live preview**: same approach as Page Numbers — render on canvas overlay, debounced 200ms. Draw the watermark text on canvas at the specified angle/opacity. Do NOT call worker for preview.
- PreviewPanel with "Show Original" toggle
- Filename: `{name}_watermarked.pdf`

### Tests
- Add watermark to 3-page PDF → verify pages have content changes
- Tile mode → verify multiple text instances per page (check output is larger than original)

---

## Tool 10: Scale / Resize Pages

### Worker Operation: `scale`
- Receives: PDF bytes + `{ targetWidth, targetHeight, fitContent, pages }`
- For each specified page:
  - If fitContent: use **Form XObject approach** — embed the original page as a Form XObject, create a new page with target dimensions, draw the XObject scaled to fit. This is safer than raw content stream manipulation which corrupts complex PDFs.
  - If not fitContent: just change MediaBox to new dimensions (content stays same size, visible area changes)
- Progress: per-page with cancel check

### Component: ScaleResizeTool.tsx
- **Target size**: dropdown — A4 | Letter | Legal | A3 | A5 | Custom
- For Custom: width + height inputs with unit toggle (mm | in | pt). Convert to points internally.
- **"Fit content to new size"**: checkbox (default on). Explanatory text: "Scale page content to fit new dimensions" / "Only change page boundaries without scaling content"
- **Apply to**: radio — "All pages" | "Selected pages" (PageSelector)
- PreviewPanel with "Show Original" toggle
- Filename: `{name}_resized_{target}.pdf` (e.g., `report_resized_A4.pdf`)

### Tests
- Resize A4 PDF to Letter → verify MediaBox dimensions match Letter
- Fit content on → verify output renders correctly and page dimensions match target
- Apply to selected pages only → verify unselected pages unchanged

---

## Tool 11: Encrypt (Password Protect)

IMPORTANT: Uses `pdf-lib-with-encrypt`'s encryption options on save.

### Worker Operation: `encrypt`
- Receives: PDF bytes + `{ userPassword, ownerPassword, permissions }`
- Load PDF, save with encryption options:
  ```typescript
  await pdfDoc.save({
    userPassword: options.userPassword,
    ownerPassword: options.ownerPassword,
    permissions: {
      printing: options.permissions.printing ? 'highResolution' : undefined,
      copying: options.permissions.copying,
      modifying: options.permissions.modifying,
    }
  });
  ```
- Note: pdf-lib-with-encrypt supports AES-128 and RC4-128. Default to AES-128.

### Component: EncryptTool.tsx
- **Password**: input with show/hide toggle
- **Confirm password**: input (validate match)
- **Password strength indicator**: simple bar (weak/medium/strong based on length + character variety)
- **Permissions** (checkboxes):
  - Allow printing (default on)
  - Allow copying text (default on)
  - Allow editing (default off)
- **Encryption info**: non-editable text "AES-128 encryption"
- Process button: disabled until passwords match and are non-empty
- Filename: `{name}_encrypted.pdf`

### Tests
- Encrypt PDF with password → verify output loads only with correct password
- Verify permissions are set in output

---

## Tool 12: Unlock PDF

### Worker Operation: `unlock`
- Receives: PDF bytes + `{ password }`
- Load PDF with password: `PDFDocument.load(bytes, { password })`
- Save without encryption: `pdfDoc.save()` (no encryption options)
- Handle: wrong password (throw specific error), not encrypted (detect and inform)

### Component: UnlockTool.tsx
- After file upload, auto-detect if PDF is encrypted
- If **not encrypted**: show info message "This PDF is not password-protected. No action needed." + option to go back
- If **encrypted**: show password input + "Unlock" button
- Password input with show/hide toggle
- On wrong password: inline error below input "Incorrect password. Please try again."
- Filename: `{name}_unlocked.pdf`

### Tests
- Unlock encrypted PDF with correct password → verify output opens without password
- Wrong password → verify error
- Non-encrypted PDF → verify detection

---

## Tool 13: Edit Metadata

### Worker Operation: `edit-metadata`
- Receives: PDF bytes + `{ title, author, subject, keywords, creator, producer, clearAll }`
- Load PDF
- If clearAll: set all fields to empty string
- Else: apply each provided field via `pdfDoc.setTitle()`, `.setAuthor()`, etc.
- Save

### Component: MetadataEditorTool.tsx
- Form with text inputs, pre-filled with existing metadata values:
  - Title, Author, Subject, Keywords, Creator, Producer
- Read-only display: Creation date, Modification date (formatted nicely)
- **"Clear all metadata"** button: clears all fields (with confirmation)
- Process button: "Save Changes"
- Filename: `{name}_edited.pdf`

### Tests
- Set title and author → verify in output metadata
- Clear all → verify all fields empty in output

---

## Definition of Done for Phase 3

- [ ] All 7 tools work end-to-end
- [ ] Encrypt tool produces PDFs that require password in Adobe Acrobat, Chrome viewer, macOS Preview
- [ ] Unlock tool correctly removes password protection
- [ ] Page Numbers and Watermark live previews update responsively without calling the worker
- [ ] Live previews are debounced (no flicker during rapid slider changes)
- [ ] "Show Original" toggle works for Page Numbers, Watermark, and Scale tools
- [ ] Mixed page sizes handled correctly in Page Numbers, Watermark, and Scale tools
- [ ] All cancel/progress/filename patterns consistent with Phase 2 tools
- [ ] Integration tests pass for all 7 tools
- [ ] All 13 tools now accessible from the landing grid
