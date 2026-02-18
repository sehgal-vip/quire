# Quire

Client-side PDF manipulation web app. Zero backend. All processing in browser. Hosted on GitHub Pages.

## Architecture

Read `docs/SPEC.md` for full architecture. Key points:
- React 18 + Vite + TypeScript (strict) + Tailwind CSS v3 + Zustand
- **ALL pdf-lib operations run in a Web Worker** — main thread NEVER imports pdf-lib-with-encrypt
- PDF.js handles thumbnail rendering on main thread (its own internal worker handles parsing)
- Hash-based routing (#split, #merge) — no react-router

## Critical Rules

- ALWAYS import from `pdf-lib-with-encrypt`, NEVER from `pdf-lib`
- NEVER do pdf-lib operations on the main thread — always via the worker client (`src/lib/pdf-worker-client.ts`)
- Every tool component follows the `ToolProps` interface from `src/types/index.ts`
- Tailwind v3 (NOT v4) — use `tailwind.config.js`, not CSS-native config
- Pin dependency versions exactly — no caret ranges for pdf-lib-with-encrypt or pdfjs-dist
- Use error strings from `src/lib/error-messages.ts`, not inline strings

## Commands

```
npm run dev          # Start dev server
npm run build        # Production build
npm run test         # Run vitest
npm run lint         # ESLint check
npm run type-check   # tsc --noEmit
```

## Project Structure

```
src/components/tools/   — One file per tool (SplitTool.tsx, MergeTool.tsx, etc.)
src/components/common/  — Shared UI (FileDropZone, ThumbnailGrid, PageSelector, etc.)
src/workers/            — Web Worker for pdf-lib operations
src/stores/             — Zustand stores (appStore, fileStore, processingStore, editorStore)
src/lib/                — Pure utility modules (parser, validator, filename generator, etc.)
src/hooks/              — Custom React hooks
src/types/              — TypeScript interfaces
```

## Phase Docs

Implementation is split into phases. Read the relevant phase doc before implementing:
- `docs/SPEC.md` — Master spec (read FIRST, always)
- `docs/PHASE-1.md` — Foundation, infrastructure, shared components
- `docs/PHASE-2.md` — Core tools (Split, Merge, Rotate, Reorder, Delete, Extract)
- `docs/PHASE-3.md` — Remaining tools (Blank Pages, Page Numbers, Watermark, Scale, Encrypt, Unlock, Metadata)
- `docs/PHASE-4.md` — Pipeline system
- `docs/PHASE-5.md` — Polish, deployment, accessibility
- `docs/PHASE-6.md` — Edit PDF, Convert to PDF

## Gotchas

- `pdf-lib-with-encrypt` is a community fork with 1 maintainer. If API issues arise, check `pdf-lib-plus-encrypt` as fallback.
- When transferring ArrayBuffers to worker as Transferable, the sender loses access. Clone first if main thread still needs the data.
- `pdf-lib.copyPages()` silently drops annotations, form fields, and bookmarks. Warn users.
- `StandardFonts.Helvetica` only supports Latin-1. Non-Latin watermark/page number text needs `@pdf-lib/fontkit` + Noto Sans font.
- PDF.js has its own internal web worker (auto-managed). Do NOT create a second PDF.js worker.
- Scale/Resize: use Form XObject approach, NOT raw content stream matrix manipulation.
- Merge is excluded from Pipeline mode (needs multiple file inputs — `pipelineCompatible: false`).
- Edit PDF, and Convert to PDF are also `pipelineCompatible: false`.
- Edit PDF text editing is cover-and-replace (colored rect + new text overlay), NOT real text modification. Font matching is approximate. Cover color defaults to white — user can change via color picker for non-white backgrounds.
- **PDF.js version must be 3.4+** for `saveDocument()`, `AnnotationStorage`, `AnnotationMode.ENABLE_STORAGE`, `convertToViewportPoint()`.
- **Form Fill: use `pdfDocProxy.saveDocument()`, NOT DOM scraping.** Do NOT build annotation ID → field name mappings. PDF.js AnnotationStorage handles form data internally.
- **AnnotationLayer needs CSS**: import `pdfjs-dist/web/pdf_viewer.css` or form widgets render in wrong positions.
- **Layer pointer-events must toggle per mode.** Form Fill → Form Layer active, overlay disabled. Add Text / Edit Text → overlay active, Form Layer disabled.
- **Edit Text coordinates: store raw PDF Y (`transform[5]`), do NOT flip.** Convert to screen coords ONLY at render time using `viewport.convertToViewportPoint()`.
- **`getTextContent()` width is already in PDF points.** No viewport dependency — `item.width` is always in user-space units. Do NOT create a viewport for extraction or divide by scale.
- **Lazy text extraction** — per page, not all pages. Only call `getTextContent()` for current page in Edit Text mode. Cache in `Record` (not `Map`).
- **Add Text worker MUST handle bold/italic.** Use `getStandardFont(family, bold, italic)` to select from all 12 standard font variants.
- **Cover rectangle must cover descenders.** Baseline is `transform[5]`, descenders extend ~25% below. Use `y - height * 0.25 - 1` for rect Y.
- **Bidirectional coordinate conversion required**: `screenToPDF()` for clicks, `pdfToScreen()` for rendering overlays. Both handle rotation automatically.
- **`embedJpg()`/`embedPng()` are async** — must `await` them. Missing await silently breaks output.
- **Margin: use `??` not `||`** — `config.margin || 72` treats 0 as falsy. Use `config.margin ?? 36`.
- **`extractRuns`: do NOT `.trim()` text nodes** — strips inter-element whitespace, merging words.
- **HTML parser: check images BEFORE paragraphs.** Mammoth wraps `<img>` in `<p>`, causing double image blocks if image check is outside the if-else chain.
- **Per-run layout engine**: do NOT flatten all runs into one string. Declare `StyledWord`/`StyledSegment`/`StyledLine` interfaces ONCE before the block loop (not inside it).
- **Underline: captured but not rendered in v1.** `TextRun.underline` detected from `<U>` tags, stored in data model, but layout engine skips rendering. Documented in DOCX limitations banner.
- **Lazy-load mammoth**: `await import('mammoth')` on demand, not at module level (~230KB saved for image-only conversions).
- **Transferable buffers**: use `Set<ArrayBuffer>` (not array) to prevent `DataCloneError` from duplicate buffers.
- pdf-lib only embeds JPG and PNG. WebP/GIF must be converted to PNG via canvas on main thread BEFORE sending to worker.
- mammoth.js runs on main thread (needs DOMParser). Only the layout engine runs in the worker.
- mammoth does NOT support `.doc` files — only `.docx`.
- **Noto Sans: three font files, NOT one.** `NotoSans-Regular.ttf` (Latin/Cyrillic/Greek), `NotoSansArabic-Regular.ttf`, `NotoSansDevanagari-Regular.ttf`. CJK NOT supported in v1. Use `detectRequiredFonts()` from `src/lib/fonts.ts`.
- **GitHub Pages base path**: ALL asset fetches must use `${import.meta.env.BASE_URL}` — not absolute paths like `/fonts/...`.
- **Zustand store: use `Record<number, ...>`, not `Map`.** Maps break with devtools/persist middleware (`JSON.stringify(new Map())` → `"{}"`).
- `textLineHeight` default is **1.5** (not 1.4).

## Testing

- Run `npm run test` after every tool implementation
- Test fixtures in `src/__fixtures__/generate-fixtures.ts` — generate programmatically
- Every `src/lib/` module needs unit tests. Every tool needs integration test.
- Verify output PDFs: check `%PDF-` magic bytes AND that pdf-lib can re-load the output.

## When Compacting

When compacting, always preserve: the current phase being implemented, list of completed vs remaining tools, and any failing test details.
