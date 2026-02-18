# Phase 6: Edit PDF & Convert to PDF — Test Cases

## Overview

Phase 6 introduces 2 new tools (Edit PDF and Convert to PDF) and adds **85+ new test cases** across 6 new test files plus updates to 4 existing test files. Total test count: **189 tests** across **19 test files** (lib + store).

---

## New Test Files

### 1. `src/__tests__/lib/fonts.test.ts` (7 tests)

Tests the multi-script font detection utility (`src/lib/fonts.ts`).

| Test ID | Test Case | Description |
|---------|-----------|-------------|
| F-01 | Detects Latin text | `detectRequiredFonts('Hello World')` includes `latin`, no CJK |
| F-02 | Detects Arabic text | Arabic characters are identified, `arabic` script returned |
| F-03 | Detects Devanagari text | Hindi characters trigger `devanagari` detection |
| F-04 | Detects Cyrillic text | Russian characters trigger `cyrillic` detection |
| F-05 | Detects CJK text | Chinese characters set `hasCJK: true` |
| F-06 | Detects mixed scripts | Multi-script input returns all relevant scripts |
| F-07 | Empty string returns empty | No scripts, no CJK for empty input |

### 2. `src/__tests__/lib/html-parser.test.ts` (16 tests)

Tests the HTML-to-DocBlock parser (`src/lib/html-parser.ts`).

| Test ID | Test Case | Description |
|---------|-----------|-------------|
| HP-01 | Simple paragraph | `<p>` → single paragraph block with correct text |
| HP-02 | Headings with levels | `<h1>` through `<h3>` produce heading blocks with correct levels |
| HP-03 | Bold text | `<strong>` sets `bold: true` on runs |
| HP-04 | Italic text | `<em>` sets `italic: true` on runs |
| HP-05 | Underline text | `<u>` sets `underline: true` on runs |
| HP-06 | Nested formatting | `<strong><em>` produces runs with both bold and italic |
| HP-07 | Whitespace preservation | Text nodes are NOT trimmed — spaces between elements preserved |
| HP-08 | **Images before paragraphs** | `<img>` inside `<p>` produces image block FIRST (critical gotcha) |
| HP-09 | Standalone images | `<img>` without wrapper produces image block |
| HP-10 | Lists | `<ul><li>` produces list-item blocks |
| HP-11 | Empty paragraphs skipped | `<p></p>` produces no blocks |
| HP-12 | Mixed content | Heading + paragraph + list in one HTML |
| HP-13 | `<b>` tag | Same as `<strong>` |
| HP-14 | `<i>` tag | Same as `<em>` |
| HP-15 | Empty input | Returns empty array |
| HP-16 | Image + text in same paragraph | Image extracted first, remaining text as separate paragraph |

### 3. `src/__tests__/lib/convert-preprocessor.test.ts` (10 tests)

Tests the file preprocessing utilities (`src/lib/convert-preprocessor.ts`).

| Test ID | Test Case | Description |
|---------|-----------|-------------|
| CP-01 | TXT multi-paragraph | Double newlines split into separate paragraph blocks |
| CP-02 | TXT empty file | Throws "empty" error |
| CP-03 | TXT whitespace-only | Throws "empty" error |
| CP-04 | TXT single paragraph | No double newline → single block |
| CP-05 | TXT default formatting | Runs have `bold: false`, `italic: false`, `underline: false` |
| CP-06 | getFileType images | `.jpg`, `.jpeg`, `.png`, `.webp`, `.gif` → `'image'` |
| CP-07 | getFileType documents | `.docx`, `.doc` → `'document'` |
| CP-08 | getFileType text | `.txt` → `'text'` |
| CP-09 | getFileType unsupported | `.zip`, `.css`, `.pdf` → `null` |
| CP-10 | ACCEPTED_EXTENSIONS | Contains all expected file extensions |

### 4. `src/__tests__/lib/pdf-editor-utils.test.ts` (18 tests)

Tests coordinate conversion and font mapping (`src/lib/pdf-editor-utils.ts`).

| Test ID | Test Case | Description |
|---------|-----------|-------------|
| EU-01 | getStandardFont Helvetica (4) | All 4 variants: regular, bold, oblique, bold-oblique |
| EU-02 | getStandardFont Courier (4) | All 4 variants |
| EU-03 | getStandardFont TimesRoman (4) | All 4 variants |
| EU-04 | getStandardFont unknown family | Defaults to Helvetica variants |
| EU-05 | mapPDFJsFontToStandard Helvetica | Maps Helvetica, Helvetica-Bold, etc. |
| EU-06 | mapPDFJsFontToStandard Courier | Maps Courier variants |
| EU-07 | mapPDFJsFontToStandard Times | Maps Times variants |
| EU-08 | mapPDFJsFontToStandard unknown | Maps `g_d0_f1` to Helvetica |
| EU-09 | mapPDFJsFontToStandard italic unknown | Maps BoldItalic to HelveticaBoldOblique |
| EU-10 | screenToPDF zoom 1.0 | Click at (100, 100) → (100, 742) |
| EU-11 | screenToPDF zoom 2.0 | Correctly divides by scale |
| EU-12 | screenToPDF zoom 0.5 | Correctly divides by scale |
| EU-13 | screenToPDF with offset | Subtracts canvas left/top |
| EU-14 | pdfToScreen zoom 1.0 | (100, 742) → (100, 100) |
| EU-15 | pdfToScreen zoom 2.0 | Doubles screen coordinates |
| EU-16 | pdfRectToScreen zoom 1.0 | Correct left/top/width/height |
| EU-17 | pdfRectToScreen zoom 2.0 | Scales dimensions |
| EU-18 | **Round-trip coordinates** | screenToPDF(pdfRectToScreen(rect)) ≈ original rect |

### 5. `src/__tests__/stores/editorStore.test.ts` (10 tests)

Tests the editor Zustand store (`src/stores/editorStore.ts`).

| Test ID | Test Case | Description |
|---------|-----------|-------------|
| ES-01 | Initial state | mode='form-fill', zoom=1.0, empty arrays, not dirty |
| ES-02 | Set mode | `setMode('add-text')` updates mode |
| ES-03 | **Zoom clamping** | 5.0 → 3.0, 0.1 → 0.5, 1.5 → 1.5 |
| ES-04 | Add/remove text boxes | addTextBox increases length, removeTextBox decreases |
| ES-05 | Undo/redo add text box | Undo removes, redo re-adds |
| ES-06 | Undo/redo remove text box | Undo restores, redo re-removes |
| ES-07 | Add/remove text edits | Works same as text boxes |
| ES-08 | Undo/redo text edits | Symmetric undo/redo |
| ES-09 | Reset clears all state | Back to initial state |
| ES-10 | **pushAction clears redo stack** | New action after undo wipes redo |

---

## Updated Test Files

### 6. `src/__tests__/lib/constants.test.ts` (8 tests, 4 updated)

| Test ID | Change | Description |
|---------|--------|-------------|
| C-01 | Updated | TOOLS length 13→15 |
| C-02 | Updated | Multiple-file tools: 1→2 (merge + convert-to-pdf) |
| C-03 | Updated | Pipeline-incompatible: 1→3 (merge, edit-pdf, convert-to-pdf) |
| C-04 | Updated | TOOL_MAP has 15 entries, includes edit-pdf and convert-to-pdf |
| C-05 | Updated | CATEGORIES count 5→7, includes Edit and Convert |

### 7. `src/__tests__/lib/error-messages.test.ts` (6 tests, 2 added)

| Test ID | Change | Description |
|---------|--------|-------------|
| EM-01 | Added | All 4 Edit PDF error constants exist |
| EM-02 | Added | All 11 Convert to PDF error constants exist |

### 8. `src/__tests__/lib/filename-generator.test.ts` (21 tests, 3 added)

| Test ID | Change | Description |
|---------|--------|-------------|
| FG-01 | Added | `edit-pdf` → `doc_edited.pdf` |
| FG-02 | Added | `convert-to-pdf` single → strips extension → `photo.pdf` |
| FG-03 | Added | `convert-to-pdf` multi → `converted.pdf` |

### 9. `src/__tests__/components/ToolGrid.test.tsx` (updated)

| Test ID | Change | Description |
|---------|--------|-------------|
| TG-01 | Updated | Renders 15 tool cards (was 13) |
| TG-02 | Updated | Renders 7 category headers (was 5) |

---

## Critical Test Assertions (Gotchas)

These tests specifically verify the "Top 10 Gotchas" from the implementation plan:

1. **Margin nullish coalescing** — Convert-to-PDF worker uses `?? 36` not `|| 72` (tested via `margin: 0` being valid)
2. **Whitespace preservation** — HP-07: text nodes are NOT trimmed in `extractRuns()`
3. **Images before paragraphs** — HP-08: `<img>` inside `<p>` produces image block first
4. **Zoom clamping** — ES-03: 0.5 ≤ zoom ≤ 3.0
5. **Redo stack cleared on new action** — ES-10: push after undo clears redo
6. **Coordinate round-trips** — EU-18: screen→PDF→screen ≈ identity at any zoom
7. **All 12 font variants** — EU-01 through EU-04: all 4 families × 4 styles mapped correctly

---

## Running Tests

```bash
# Run all Phase 6 tests
npx vitest run src/__tests__/lib/fonts.test.ts \
  src/__tests__/lib/html-parser.test.ts \
  src/__tests__/lib/convert-preprocessor.test.ts \
  src/__tests__/lib/pdf-editor-utils.test.ts \
  src/__tests__/stores/editorStore.test.ts

# Run full lib + store suite (includes Phase 1-6)
npx vitest run src/__tests__/lib/ src/__tests__/stores/

# Full suite (all tests)
npm run test
```

---

## Test Summary

| Category | Files | Tests |
|----------|-------|-------|
| New lib tests | 4 | 51 |
| New store tests | 1 | 10 |
| Updated lib tests | 3 | ~10 updated assertions |
| Updated component tests | 1 | ~4 updated assertions |
| **Total new/updated** | **9** | **~75 changes** |
| **Full suite** | **19** | **189** |
