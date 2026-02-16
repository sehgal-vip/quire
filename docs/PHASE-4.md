# Quire — Phase 4: Pipeline System

Read SPEC.md for architecture. Phases 1-3 must be complete. This phase adds multi-tool pipeline functionality.

---

## Overview

The pipeline lets users chain up to **5 tools** in sequence. The output of tool N becomes the input of tool N+1. All processing happens in-memory — intermediate results are kept as Uint8Array.

---

## Pipeline Validator

### `src/lib/pipeline-validator.ts`

Takes a pipeline (ordered array of tool IDs) and returns validation warnings/errors.

**Rules:**
1. **Max 5 tools** — hard limit. If user tries to add a 6th, show: "Pipeline is limited to 5 steps to ensure reliable performance."
2. **Unlock should come first** if present — if any tool appears before "unlock", warn: "Unlock PDF should be the first step so other tools can read the PDF content."
3. **Encrypt should be last** — if any tool appears after "encrypt", warn: "Encrypt should be the last step. Tools after it would need the password to process the PDF."
4. **Delete before Page Numbers** — if both present and delete comes after page-numbers, suggest: "Consider moving Delete Pages before Add Page Numbers so numbers are correct after deletion."
5. **Duplicate tools** — if same tool appears twice, show subtle note: "'{tool name}' appears twice in the pipeline. Is that intentional?"

**Validation result:**
```typescript
interface ValidationResult {
  valid: boolean;
  warnings: { message: string; type: 'error' | 'warning' | 'suggestion' }[];
}
```

Errors block execution. Warnings and suggestions are informational only.

**Unit tests:** Test each rule individually + combinations.

---

## Pipeline Presets

### `src/lib/pipeline-presets.ts`

```typescript
const presets: PipelinePreset[] = [
  {
    id: 'scan-cleanup',
    name: 'Scan Cleanup',
    description: 'Remove password, delete blank pages, add page numbers',
    icon: 'ScanLine',
    tools: ['unlock', 'delete-pages', 'add-page-numbers'],
  },
  {
    id: 'secure-stamp',
    name: 'Secure & Stamp',
    description: 'Add a watermark and password-protect',
    icon: 'ShieldCheck',
    tools: ['text-watermark', 'encrypt'],
  },
  {
    id: 'document-prep',
    name: 'Document Prep',
    description: 'Reorder, clean up, number, and brand your document',
    icon: 'FileCheck',
    tools: ['reorder', 'delete-pages', 'add-page-numbers', 'text-watermark'],
  },
  {
    id: 'number-lock',
    name: 'Number & Lock',
    description: 'Add page numbers and password-protect',
    icon: 'Lock',
    tools: ['add-page-numbers', 'encrypt'],
  },
];
```

---

## Pipeline Store

Add to `useAppStore` or create `usePipelineStore`:

```typescript
interface PipelineStore {
  selectedTools: string[];           // Tool IDs in order (max 5)
  currentStep: number;               // 0-indexed, which step is active
  stepStatus: Record<number, 'pending' | 'configuring' | 'processing' | 'done' | 'failed' | 'skipped'>;
  intermediateResults: Record<number, Uint8Array>;  // Output bytes per step
  validation: ValidationResult;

  addTool: (toolId: string) => void;
  removeTool: (index: number) => void;
  reorderTools: (fromIndex: number, toIndex: number) => void;
  loadPreset: (preset: PipelinePreset) => void;
  clearPipeline: () => void;

  startPipeline: () => void;
  completeStep: (stepIndex: number, outputBytes: Uint8Array) => void;
  failStep: (stepIndex: number, error: string) => void;
  skipStep: (stepIndex: number) => void;
  retryStep: (stepIndex: number) => void;
  goToStep: (stepIndex: number) => void;
}
```

---

## PipelineBuilder Component

Shown when `pipelineMode` is active on the landing page.

### Tool Selection (Grid mode)
- Tool cards become multi-select. Clicking a card adds it to the pipeline (or removes if already added).
- **Merge is excluded** from pipeline selection (grayed out with tooltip: "Merge requires multiple file inputs and can't be used in a pipeline"). Check `tool.pipelineCompatible === true`.
- Selected cards show a numbered badge (1, 2, 3...) indicating order.
- Cards gray out after 5 tools are selected.

### Pipeline List (above or beside the grid)
- Ordered list of selected tools with:
  - Number badge
  - Tool icon + name
  - Drag handle for reordering (dnd-kit sortable)
  - Remove button (X)
  - Keyboard: select item → arrow up/down to reorder → Enter to confirm
- Validation warnings appear inline below relevant steps (yellow for warnings, blue for suggestions)
- "Start Pipeline" button: disabled until 2+ tools selected and no errors in validation
- "Clear" button to reset

### PipelinePresets Component
- Shown above the tool grid in Pipeline mode
- Row of 3-4 preset cards
- Each card: icon + name + description + tool sequence shown as small chips
- Click to auto-populate the pipeline list

---

## Pipeline Execution (Step-by-Step Wizard)

### Layout
- **Left sidebar** (250px): Pipeline stepper showing all steps
  - Each step: number + tool icon + tool name + status indicator
  - Status: gray circle (pending), blue pulsing (active), green check (done), red X (failed), gray dash (skipped)
  - Clickable to jump back to completed steps (for review, not re-execution)
- **Main area**: Current step's tool interface

### Flow

**Step 0: File Upload**
- Show FileDropZone (with recent files from cache)
- After upload, automatically proceed to Step 1

**Steps 1-N: Tool Configuration & Execution**
For each step:
1. Show the tool's component with the current input (original file for step 1, previous step's output for step 2+)
2. User configures options
3. User clicks "Apply & Continue"
4. Worker processes the operation
5. Progress bar shows step-specific progress
6. **Intermediate preview**: after processing completes, briefly show:
   - Thumbnail of result + page count + file size
   - Three buttons: **"Continue to Next Step"** (primary) | **"Reconfigure"** (secondary) | **"Skip & Continue"** (secondary, passes current input unchanged to next step)
7. On "Continue": save intermediate bytes, advance to next step
8. On "Reconfigure": reset this step's processing, re-show tool controls with previous config
9. On "Skip": pass the input bytes through to next step, mark step as "skipped"

**Error Recovery**
If processing fails at any step:
- Show error message clearly in the step UI
- Three buttons:
  - **"Retry"**: reopen tool controls with previous config pre-filled
  - **"Skip"**: pass previous step's output to next step, mark as "skipped"
  - **"Cancel Pipeline"**: stop execution. If any intermediate results exist, offer to download the last successful output.

**Final Step: Complete**
- Show full PreviewPanel with output file size
- "Download" button
- "Process another file" button (resets entire pipeline to Step 0)
- Show pipeline summary: list of steps with status (completed/skipped/etc.)

---

## Memory Management

With up to 5 steps, each holding a full PDF in memory:
- Store only the LAST intermediate result + the original input
- When step N+1 starts, the step N-1 intermediate can be discarded (keep only N's output as N+1's input)
- Exception: if user wants to "go back", they'll need to re-process from the original
- On pipeline completion or cancellation, null out all intermediate ArrayBuffers

---

## Definition of Done for Phase 4

- [ ] Pipeline mode toggle works on landing page
- [ ] Presets populate pipeline list correctly
- [ ] Tool cards show numbered badges in pipeline mode and respect 5-tool limit
- [ ] Pipeline list supports drag-and-drop reordering with keyboard alternative
- [ ] Validation runs on every change with inline warnings/suggestions
- [ ] Start Pipeline → file upload → step-by-step wizard flow works end-to-end
- [ ] Each step shows correct tool interface with correct input (original or previous output)
- [ ] Intermediate preview with Continue/Reconfigure/Skip works
- [ ] Error recovery: Retry/Skip/Cancel all functional
- [ ] Cancel Pipeline offers download of last successful intermediate result
- [ ] Pipeline stepper shows correct status per step
- [ ] Memory: intermediate results cleaned up after pipeline completes
- [ ] "Process another file" resets entire pipeline
- [ ] Pipeline validator tests pass for all 5 rules
