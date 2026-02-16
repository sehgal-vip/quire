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
src/stores/             — Zustand stores (appStore, fileStore, processingStore)
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

## Gotchas

- `pdf-lib-with-encrypt` is a community fork with 1 maintainer. If API issues arise, check `pdf-lib-plus-encrypt` as fallback.
- When transferring ArrayBuffers to worker as Transferable, the sender loses access. Clone first if main thread still needs the data.
- `pdf-lib.copyPages()` silently drops annotations, form fields, and bookmarks. Warn users.
- `StandardFonts.Helvetica` only supports Latin-1. Non-Latin watermark/page number text needs `@pdf-lib/fontkit` + Noto Sans font.
- PDF.js has its own internal web worker (auto-managed). Do NOT create a second PDF.js worker.
- Scale/Resize: use Form XObject approach, NOT raw content stream matrix manipulation.
- Merge is excluded from Pipeline mode (needs multiple file inputs — `pipelineCompatible: false`).

## Testing

- Run `npm run test` after every tool implementation
- Test fixtures in `src/__fixtures__/generate-fixtures.ts` — generate programmatically
- Every `src/lib/` module needs unit tests. Every tool needs integration test.
- Verify output PDFs: check `%PDF-` magic bytes AND that pdf-lib can re-load the output.

## When Compacting

When compacting, always preserve: the current phase being implemented, list of completed vs remaining tools, and any failing test details.
