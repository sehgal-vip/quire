# Quire Prompt Suite — Comprehensive Audit

## 1. Service Workers vs Web Workers — Clarification

**You only need ONE Service Worker.** That's for caching/offline. Already in the spec. Correct.

**You're probably asking about Web Workers.** Current architecture has ONE Web Worker for pdf-lib operations. The question is whether PDF.js thumbnail rendering should get its own dedicated worker.

**Answer: No, keep the current architecture.** Here's why:

PDF.js already internally spawns its own Web Worker (`pdf.worker.js`) for the heavy lifting — parsing PDF structure, decoding fonts, processing content streams. The canvas rendering that happens on the main thread is the lightweight final step. Our render queue (max 3-4 concurrent renders) already throttles this sufficiently.

Adding a separate OffscreenCanvas-based thumbnail worker would require:
- Fake `ownerDocument` hacks (PDF.js expects a DOM)
- Known rendering bugs with gradients and some fonts in OffscreenCanvas
- Complex ImageBitmap transfer back to main thread
- Effectively doubles PDF.js memory usage (two instances parsing the same PDF)

**Not worth the complexity for v1.** The render queue with IntersectionObserver is the correct solution. If profiling later shows main-thread bottlenecks from canvas rendering specifically, THEN consider OffscreenCanvas — but it's unlikely to be the bottleneck.

**Final worker count: 3 threads total**
- Main thread: React UI, canvas rendering (throttled by render queue)
- Web Worker 1: `pdf-engine.worker.ts` — all pdf-lib-with-encrypt operations
- Web Worker 2: PDF.js internal worker (`pdf.worker.js`) — PDF parsing/decoding (auto-spawned by pdfjs-dist, NOT managed by us)
- Service Worker: caching/offline only

---

## 2. Blind Spots Found

### CRITICAL — Must fix before building

**2.1 `pdf-lib-with-encrypt` is a low-maintenance package**
- 1,476 weekly downloads, single maintainer, last published 1 year ago
- No other packages depend on it in the npm registry
- Risk: if it breaks with a future browser update, nobody is maintaining it
- **Mitigation to add to SPEC.md**: "If `pdf-lib-with-encrypt` becomes unusable, fallback options: (a) `pdf-lib-plus-encrypt` — similar fork with different maintainer, (b) use standard `pdf-lib` for everything except encrypt/unlock, and add `@pdfsmaller/pdf-encrypt-lite` (7KB, RC4-128 only, actively maintained) as a separate encryption layer."
- **Also add**: pin the version in `package.json` with exact version, not caret range

**2.2 ArrayBuffer Transferable ownership trap**
- SPEC.md says "Transfer ArrayBuffers as Transferable to avoid memory copying"
- **Problem**: when you transfer an ArrayBuffer, the sender LOSES access to it — it becomes zero-length
- If the main thread transfers PDF bytes to the worker, it can no longer display thumbnails or let the user re-process
- **Fix**: the worker client must either (a) clone the bytes before transferring (`new Uint8Array(original)`) for cases where the main thread still needs them, OR (b) transfer TO the worker, then the worker transfers the result BACK. Spell this out explicitly in the worker client spec.

**2.3 `UploadedFile` type is never defined**
- Used everywhere (`ToolProps.files`, `FileStore.currentFiles`) but never defined in SPEC.md
- `CachedFile` is defined. `UploadedFile` is referenced but missing.
- **Fix**: Add to SPEC.md types:
  ```typescript
  interface UploadedFile {
    id: string;
    name: string;
    bytes: Uint8Array;
    pageCount: number;
    fileSize: number;
    isEncrypted: boolean;
    password?: string;  // if user provided password for encrypted PDF
  }
  ```

**2.4 Merge tool in Pipeline is broken by design**
- Pipeline feeds output of step N as input to step N+1 (single file)
- Merge requires MULTIPLE file inputs
- PHASE-4.md never addresses this
- **Fix**: Either (a) exclude Merge from pipeline entirely and document why, OR (b) in pipeline mode, Merge uses the pipeline input as one file and prompts for additional files. Option (a) is simpler and less confusing. Add a `pipelineCompatible: boolean` flag to the tool interface and set Merge to `false`.

**2.5 copyPages loses annotations and form fields**
- pdf-lib's `copyPages()` transfers page content but silently drops: annotations, form fields, JavaScript actions, embedded files, bookmarks
- Users will lose existing annotations/form fields on Split, Merge, Reorder, Delete, Extract
- **Fix**: Add explicit warning in each affected tool's EmptyState/help text: "Note: Annotations and form fields may not be preserved." Add to SPEC.md known limitations section.

**2.6 Scale/Resize content stream manipulation is extremely fragile**
- PHASE-3.md says: "wrap existing content stream in a transform matrix"
- pdf-lib has no clean API for this. You'd need to manually decompress the content stream, prepend a `cm` (concat matrix) operator, and re-wrap — or create a Form XObject and draw it scaled
- On complex PDFs with multiple content streams, this WILL produce corrupt output
- **Fix**: Change Scale tool to use the Form XObject approach (wrap original page as XObject, create new page with target dimensions, draw XObject scaled). This is safer. If even that fails, fall back to MediaBox-only resize with a clear warning. Document this in PHASE-3.md.

### HIGH — Should fix

**2.7 Non-Latin text in Page Numbers and Watermark**
- Spec says `embedFont(StandardFonts.Helvetica)` — this only supports Latin-1 characters
- Users with Chinese, Arabic, Hindi, Korean watermark text will get boxes/missing characters
- **Fix**: Add `@pdf-lib/fontkit` as a dependency (already referenced in pdf-lib-with-encrypt docs). Bundle a basic Unicode font (e.g., Noto Sans, ~300KB subset) or let users choose: "Standard (Latin only)" vs "Unicode (supports all languages, larger output)". At minimum, validate input and warn if non-Latin characters detected.

**2.8 No OOM (out-of-memory) handling**
- "Memory warning" exists for large files, but no handling for when browser actually runs out of memory mid-processing
- Worker will silently crash. Main thread won't know why.
- **Fix**: Add `worker.onerror` handler in `pdf-worker-client.ts`. If worker dies unexpectedly (no response, error event), show specific error: "Processing failed — this file may be too large for your browser. Try a smaller file or close other tabs." Add to SPEC.md worker architecture section.

**2.9 No version pinning for pdfjs-dist**
- PDF.js has breaking API changes between major versions (v2 → v3 → v4 changed `getViewport`, worker loading, etc.)
- **Fix**: Pin to a specific version in SPEC.md dependencies, e.g., `pdfjs-dist@4.x` (or whatever is latest stable). Add note: "Pin PDF.js version. Do not upgrade without testing all thumbnail rendering paths."

**2.10 Duplicate pipeline presets**
- "Secure & Stamp" has tools: `['text-watermark', 'encrypt']`
- "Quick Protect" has tools: `['text-watermark', 'encrypt']`
- These are identical.
- **Fix**: Remove "Quick Protect" or change it to something different, e.g., `['add-page-numbers', 'encrypt']` — "Number & Lock".

### MEDIUM — Good to fix

**2.11 No loading state for initial app load**
- React + all libs + PDF.js worker is a significant bundle
- On slow connections, user sees blank white page
- **Fix**: Add minimal inline `<style>` and loading indicator in `index.html` (outside React). CSS-only spinner, no JS dependency. Gets replaced when React mounts.

**2.12 No explicit error message catalog**
- Each tool handles errors ad hoc. No consistent error messages.
- **Fix**: Add `src/lib/error-messages.ts` with constants:
  ```
  INVALID_PDF, ENCRYPTED_PDF_NEEDS_PASSWORD, WRONG_PASSWORD,
  FILE_TOO_LARGE, WORKER_CRASHED, OPERATION_CANCELLED,
  CANNOT_DELETE_ALL_PAGES, MERGE_NEEDS_TWO_FILES, etc.
  ```

**2.13 Tailwind CSS version not specified**
- Tailwind v3 vs v4 have fundamentally different setups (v4 is CSS-native, no config file)
- **Fix**: Specify `Tailwind CSS v3` in SPEC.md. V4 is too new and Claude Code examples/training data will skew v3.

**2.14 No ESLint/Prettier**
- Code formatting will be inconsistent across Claude Code sessions
- **Fix**: Add to Phase 1 Step 1: "Configure ESLint (flat config) + Prettier. Use `eslint-config-react-app` or similar. Run lint in CI."

**2.15 No `ToolOutput` type defined**
- Used in `ProcessingStore.result` and `ToolProps.onResult` but never defined
- **Fix**: Add to types:
  ```typescript
  interface ToolOutput {
    files: OutputFile[];
    processingTime: number;  // milliseconds
  }
  interface OutputFile {
    name: string;
    bytes: Uint8Array;
    pageCount: number;
  }
  ```

**2.16 Race condition: rapid Process → Cancel → Process**
- If user clicks Process, immediately cancels, then clicks Process again, two requests with different IDs are in flight
- Worker client must ignore responses for cancelled request IDs
- **Fix**: Add to `pdf-worker-client.ts` spec: "Maintain a Set of pending request IDs. On cancel, remove from pending. Ignore any WorkerResponse whose ID is not in the pending set."

---

## 3. CLAUDE.md — Yes, Create One

Based on best practices research, a CLAUDE.md file is the **single highest-leverage improvement** you can make for Claude Code. It acts as persistent project memory across sessions.

**Key principles from research:**
- Keep it concise — Claude Code follows CLAUDE.md instructions more strictly than chat prompts
- Use progressive disclosure — don't stuff everything in, point to other files
- Focus on WHAT, WHY, HOW
- Include verification commands so Claude can self-check
- Document gotchas that Claude would otherwise get wrong

**You do NOT need AGENTS.md** — that's for Cursor/Zed/other tools. CLAUDE.md is the Claude Code equivalent.

### Recommended CLAUDE.md file:

```markdown
# Quire

Client-side PDF manipulation web app. Zero backend. All processing in browser.

## Architecture

Read `docs/SPEC.md` for full architecture. Key points:
- React 18 + Vite + TypeScript (strict) + Tailwind CSS v3 + Zustand
- **ALL pdf-lib operations run in a Web Worker** — main thread NEVER imports pdf-lib-with-encrypt
- PDF.js handles thumbnail rendering on main thread (its own internal worker handles parsing)
- Hash-based routing (#split, #merge) — no react-router

## Critical Rules

- ALWAYS import from `pdf-lib-with-encrypt`, NEVER from `pdf-lib`
- NEVER do pdf-lib operations on the main thread — always via the worker client
- Every tool component follows the `ToolProps` interface from `src/types/index.ts`
- Tailwind v3 (NOT v4) — use `tailwind.config.js`, not CSS-native config
- Pin dependency versions exactly — no caret ranges for pdf-lib-with-encrypt or pdfjs-dist

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
- `docs/SPEC.md` — Master spec (read first, always)
- `docs/PHASE-1.md` — Foundation, infrastructure, shared components
- `docs/PHASE-2.md` — Core tools (Split, Merge, Rotate, Reorder, Delete, Extract)
- `docs/PHASE-3.md` — Remaining tools (Blank Pages, Page Numbers, Watermark, Scale, Encrypt, Unlock, Metadata)
- `docs/PHASE-4.md` — Pipeline system
- `docs/PHASE-5.md` — Polish, deployment, accessibility

## Gotchas

- `pdf-lib-with-encrypt` is a community fork with 1 maintainer. If API issues arise, check `pdf-lib-plus-encrypt` as fallback.
- When transferring ArrayBuffers to worker as Transferable, the sender loses access. Clone first if main thread still needs the data.
- `pdf-lib.copyPages()` silently drops annotations, form fields, and bookmarks.
- `StandardFonts.Helvetica` only supports Latin-1 characters. Non-Latin watermark/page number text needs fontkit + a Unicode font.
- PDF.js has its own internal web worker (auto-managed). Do NOT try to manually create a second PDF.js worker.
- Scale/Resize should use Form XObject approach, not raw content stream manipulation.

## Testing

- Run tests after every tool implementation: `npm run test`
- Test PDF fixtures are generated by `src/__fixtures__/generate-fixtures.ts`
- Every lib/ module needs unit tests. Every tool needs integration test.
- Always verify output PDFs load without error: check for %PDF- magic bytes and that pdf-lib can re-open the output.

## When Compacting

When compacting, always preserve: the current phase being implemented, list of completed/remaining tools, and any failing test details.
```

### Where to place it

Put `CLAUDE.md` in the project root (standard location). Put the spec/phase docs in a `docs/` folder:

```
quire/
├── CLAUDE.md              ← Claude Code reads this automatically
├── docs/
│   ├── SPEC.md
│   ├── PHASE-1.md
│   ├── PHASE-2.md
│   ├── PHASE-3.md
│   ├── PHASE-4.md
│   └── PHASE-5.md
├── src/
│   └── ...
└── package.json
```

Claude Code reads `CLAUDE.md` from the project root at session start. The `docs/` folder is referenced but only loaded when Claude needs it (progressive disclosure — saves context window).

---

## 4. Summary of Required Changes to Prompt Files

### SPEC.md changes needed:
1. Add `UploadedFile` and `ToolOutput`/`OutputFile` type definitions
2. Add `pipelineCompatible: boolean` to `PDFTool` interface
3. Add known limitations section (copyPages drops annotations, Helvetica Latin-only)
4. Add `@pdf-lib/fontkit` to dependencies
5. Add worker error handling (`worker.onerror`) to worker architecture section
6. Add ArrayBuffer transfer ownership warning
7. Pin `pdfjs-dist` version
8. Specify Tailwind CSS v3
9. Add ESLint + Prettier to Phase 1 setup
10. Add fallback encryption library note
11. Add `src/lib/error-messages.ts` to directory structure
12. Add initial HTML loading indicator

### PHASE-3.md changes needed:
1. Scale tool: change from content stream manipulation to Form XObject approach
2. Page Numbers / Watermark: add fontkit/Unicode font note
3. Encrypt tool: verify API matches actual pdf-lib-with-encrypt (pin and test first)

### PHASE-4.md changes needed:
1. Exclude Merge from pipeline (add explanation)
2. Fix duplicate preset ("Quick Protect" → "Number & Lock" or remove)
3. Add `pipelineCompatible` check to PipelineBuilder

### PHASE-5.md changes needed:
1. Add initial HTML loading state to polish items
2. Add error message catalog
