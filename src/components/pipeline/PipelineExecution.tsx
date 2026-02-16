import { useState, useCallback, useMemo, useEffect } from 'react';
import {
  Scissors, Layers, ArrowUpDown, Trash2, FileOutput, FilePlus,
  RotateCw, Maximize, Hash, Type, Lock, Unlock, FileText,
  Upload, Check, X, Minus, AlertCircle, SkipForward, RefreshCw,
  ChevronRight, Play, Loader2, XCircle,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { UploadedFile, ToolOutput } from '@/types';
import { usePipelineStore } from '@/stores/pipelineStore';
import { useAppStore } from '@/stores/appStore';
import { useProcessingStore } from '@/stores/processingStore';
import { workerClient } from '@/lib/pdf-worker-client';
import { TOOL_MAP } from '@/lib/constants';
import { formatFileSize } from '@/lib/download-utils';
import { FileDropZone } from '@/components/common/FileDropZone';
import { PreviewPanel } from '@/components/common/PreviewPanel';
import { DownloadPanel } from '@/components/common/DownloadPanel';
import { ProgressBar } from '@/components/common/ProgressBar';

// ---------------------------------------------------------------------------
// Icon map – maps the icon *string* stored in PDFTool to an actual component
// ---------------------------------------------------------------------------

const iconMap: Record<string, LucideIcon> = {
  Scissors, Layers, ArrowUpDown, Trash2, FileOutput, FilePlus,
  RotateCw, Maximize, Hash, Type, Lock, Unlock, FileText,
};

function getToolIcon(iconName: string): LucideIcon {
  return iconMap[iconName] ?? FileText;
}

// ---------------------------------------------------------------------------
// Status indicator component for the sidebar stepper
// ---------------------------------------------------------------------------

type StepStatus = 'pending' | 'configuring' | 'processing' | 'done' | 'failed' | 'skipped';

function StepStatusIndicator({ status }: { status: StepStatus }) {
  switch (status) {
    case 'pending':
      return (
        <span className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-gray-300 bg-white">
          <span className="h-2 w-2 rounded-full bg-gray-300" />
        </span>
      );
    case 'configuring':
      return (
        <span className="relative flex h-7 w-7 items-center justify-center rounded-full border-2 border-indigo-500 bg-indigo-50">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-indigo-400 opacity-30" />
          <span className="h-2 w-2 rounded-full bg-indigo-500" />
        </span>
      );
    case 'processing':
      return (
        <span className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-indigo-500 bg-indigo-50">
          <Loader2 className="h-4 w-4 animate-spin text-indigo-600" />
        </span>
      );
    case 'done':
      return (
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-green-500 text-white">
          <Check className="h-4 w-4" />
        </span>
      );
    case 'failed':
      return (
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-red-500 text-white">
          <X className="h-4 w-4" />
        </span>
      );
    case 'skipped':
      return (
        <span className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-gray-300 bg-gray-100 text-gray-400">
          <Minus className="h-4 w-4" />
        </span>
      );
  }
}

// ---------------------------------------------------------------------------
// PipelineStepControls – minimal inline configuration per tool
// ---------------------------------------------------------------------------

interface StepControlsProps {
  toolId: string;
  options: Record<string, unknown>;
  onChange: (opts: Record<string, unknown>) => void;
}

function PipelineStepControls({ toolId, options, onChange }: StepControlsProps) {
  const set = (key: string, value: unknown) => onChange({ ...options, [key]: value });

  switch (toolId) {
    case 'rotate':
      return (
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">Rotation Angle</label>
          <select
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            value={(options.angle as number) ?? 90}
            onChange={(e) => set('angle', Number(e.target.value))}
          >
            <option value={90}>90 degrees clockwise</option>
            <option value={180}>180 degrees</option>
            <option value={270}>270 degrees clockwise</option>
          </select>
        </div>
      );

    case 'delete-pages':
      return (
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">Pages to Delete</label>
          <input
            type="text"
            placeholder="e.g. 1,3,5-8"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            value={(options.pageRange as string) ?? ''}
            onChange={(e) => set('pageRange', e.target.value)}
          />
          <p className="text-xs text-gray-500">Comma-separated page numbers or ranges.</p>
        </div>
      );

    case 'extract-pages':
      return (
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">Pages to Extract</label>
          <input
            type="text"
            placeholder="e.g. 1-3,5,7"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            value={(options.pageRange as string) ?? ''}
            onChange={(e) => set('pageRange', e.target.value)}
          />
          <p className="text-xs text-gray-500">Comma-separated page numbers or ranges.</p>
        </div>
      );

    case 'add-page-numbers': {
      const positions = [
        'top-left', 'top-center', 'top-right',
        'bottom-left', 'bottom-center', 'bottom-right',
      ];
      return (
        <div className="space-y-3">
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">Position</label>
            <select
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              value={(options.position as string) ?? 'bottom-center'}
              onChange={(e) => set('position', e.target.value)}
            >
              {positions.map((p) => (
                <option key={p} value={p}>
                  {p.replace('-', ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">Format</label>
            <select
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              value={(options.format as string) ?? 'number'}
              onChange={(e) => set('format', e.target.value)}
            >
              <option value="number">1, 2, 3...</option>
              <option value="pageOfTotal">Page 1 of N</option>
              <option value="dash">- 1 -</option>
            </select>
          </div>
        </div>
      );
    }

    case 'text-watermark':
      return (
        <div className="space-y-3">
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">Watermark Text</label>
            <input
              type="text"
              placeholder="e.g. CONFIDENTIAL"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              value={(options.text as string) ?? ''}
              onChange={(e) => set('text', e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">Font Size</label>
              <input
                type="number"
                min={8}
                max={200}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                value={(options.fontSize as number) ?? 48}
                onChange={(e) => set('fontSize', Number(e.target.value))}
              />
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">Opacity</label>
              <input
                type="number"
                min={0.05}
                max={1}
                step={0.05}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                value={(options.opacity as number) ?? 0.3}
                onChange={(e) => set('opacity', Number(e.target.value))}
              />
            </div>
          </div>
        </div>
      );

    case 'encrypt':
      return (
        <div className="space-y-3">
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">User Password</label>
            <input
              type="password"
              placeholder="Password to open the PDF"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              value={(options.userPassword as string) ?? ''}
              onChange={(e) => set('userPassword', e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">Owner Password</label>
            <input
              type="password"
              placeholder="Password for full access"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              value={(options.ownerPassword as string) ?? ''}
              onChange={(e) => set('ownerPassword', e.target.value)}
            />
          </div>
        </div>
      );

    case 'unlock':
      return (
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">Password</label>
          <input
            type="password"
            placeholder="Enter PDF password"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            value={(options.password as string) ?? ''}
            onChange={(e) => set('password', e.target.value)}
          />
        </div>
      );

    case 'add-blank-pages':
      return (
        <div className="space-y-3">
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">Position</label>
            <select
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              value={(options.position as string) ?? 'end'}
              onChange={(e) => set('position', e.target.value)}
            >
              <option value="start">Beginning</option>
              <option value="end">End</option>
            </select>
          </div>
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">Number of Pages</label>
            <input
              type="number"
              min={1}
              max={100}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              value={(options.count as number) ?? 1}
              onChange={(e) => set('count', Number(e.target.value))}
            />
          </div>
        </div>
      );

    case 'scale':
      return (
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">Target Size</label>
          <select
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            value={(options.targetSize as string) ?? 'A4'}
            onChange={(e) => set('targetSize', e.target.value)}
          >
            <option value="A4">A4 (210 x 297 mm)</option>
            <option value="Letter">Letter (8.5 x 11 in)</option>
            <option value="Legal">Legal (8.5 x 14 in)</option>
            <option value="A3">A3 (297 x 420 mm)</option>
            <option value="A5">A5 (148 x 210 mm)</option>
          </select>
        </div>
      );

    case 'reorder':
      return (
        <p className="text-sm text-gray-500 italic">
          Pages will be passed through in their current order. Reordering is best done
          in the standalone tool.
        </p>
      );

    case 'edit-metadata':
      return (
        <div className="space-y-3">
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">Title</label>
            <input
              type="text"
              placeholder="Document title"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              value={(options.title as string) ?? ''}
              onChange={(e) => set('title', e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">Author</label>
            <input
              type="text"
              placeholder="Author name"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              value={(options.author as string) ?? ''}
              onChange={(e) => set('author', e.target.value)}
            />
          </div>
        </div>
      );

    default:
      return (
        <p className="text-sm text-gray-500 italic">
          No additional configuration needed. Click Apply to process.
        </p>
      );
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Estimate page count from PDF bytes (rough: count /Type /Page entries). */
function estimatePageCount(bytes: Uint8Array): number {
  // Very rough heuristic – count occurrences of "/Type /Page" (not "/Pages")
  // For display purposes only.
  try {
    const text = new TextDecoder('latin1').decode(bytes.slice(0, Math.min(bytes.length, 512_000)));
    const matches = text.match(/\/Type\s*\/Page(?!s)/g);
    return matches ? matches.length : 1;
  } catch {
    return 1;
  }
}

// ---------------------------------------------------------------------------
// PipelineExecution – main exported component
// ---------------------------------------------------------------------------

export function PipelineExecution() {
  const {
    selectedTools,
    currentStep,
    stepStatus,
    intermediateResults,
    stepErrors,
    setOriginalInput,
    advanceToStep,
    setStepConfiguring,
    setStepProcessing,
    completeStep,
    failStep,
    skipStep,
    retryStep,
    cancelPipeline,
    resetPipeline,
    getStepInput,
    getLastSuccessfulOutput,
  } = usePipelineStore();

  const setView = useAppStore((s) => s.setView);

  // Per-step options state (keyed by step index)
  const [stepOptions, setStepOptions] = useState<Record<number, Record<string, unknown>>>({});

  // Store ToolOutput results per step for preview
  const [stepOutputs, setStepOutputs] = useState<Record<number, ToolOutput>>({});

  // Whether config section is expanded per step
  const [configExpanded, setConfigExpanded] = useState<Record<number, boolean>>({});

  const totalSteps = selectedTools.length; // tool steps only (1..N)

  // --------------------------------------------------
  // Derive step definitions
  // --------------------------------------------------
  const steps = useMemo(() => {
    return selectedTools.map((toolId, idx) => {
      const tool = TOOL_MAP[toolId];
      return {
        index: idx + 1, // 1-based
        toolId,
        name: tool?.name ?? toolId,
        iconName: tool?.icon as string | undefined,
      };
    });
  }, [selectedTools]);

  // --------------------------------------------------
  // Auto-set first tool step to configuring when step advances
  // --------------------------------------------------
  useEffect(() => {
    if (currentStep >= 1) {
      const status = stepStatus[currentStep];
      if (!status || status === 'pending') {
        setStepConfiguring(currentStep);
      }
    }
  }, [currentStep, stepStatus, setStepConfiguring]);

  // --------------------------------------------------
  // Callbacks
  // --------------------------------------------------

  const handleFilesLoaded = useCallback(
    (files: UploadedFile[]) => {
      if (files.length === 0) return;
      setOriginalInput(files[0].bytes);
      advanceToStep(1);
    },
    [setOriginalInput, advanceToStep],
  );

  const handleApply = useCallback(
    async (stepIndex: number) => {
      const toolId = selectedTools[stepIndex - 1];
      const inputBytes = getStepInput(stepIndex);
      if (!inputBytes) return;

      const options = stepOptions[stepIndex] ?? {};

      useProcessingStore.getState().reset();
      setStepProcessing(stepIndex);

      try {
        const result = await workerClient.process(toolId, [inputBytes], options);
        if (result.files.length > 0) {
          completeStep(stepIndex, result.files[0].bytes);
          setStepOutputs((prev) => ({ ...prev, [stepIndex]: result }));
        } else {
          failStep(stepIndex, 'No output was produced.');
        }
      } catch (err) {
        failStep(stepIndex, err instanceof Error ? err.message : String(err));
      }
    },
    [selectedTools, stepOptions, getStepInput, setStepProcessing, completeStep, failStep],
  );

  const handleContinue = useCallback(
    (stepIndex: number) => {
      if (stepIndex < totalSteps) {
        advanceToStep(stepIndex + 1);
      }
      // If it's the final step, the view just stays showing the summary.
    },
    [totalSteps, advanceToStep],
  );

  const handleReconfigure = useCallback(
    (stepIndex: number) => {
      setStepConfiguring(stepIndex);
    },
    [setStepConfiguring],
  );

  const handleSkip = useCallback(
    (stepIndex: number) => {
      skipStep(stepIndex);
      if (stepIndex < totalSteps) {
        advanceToStep(stepIndex + 1);
      }
    },
    [skipStep, totalSteps, advanceToStep],
  );

  const handleRetry = useCallback(
    (stepIndex: number) => {
      retryStep(stepIndex);
    },
    [retryStep],
  );

  const handleCancelPipeline = useCallback(() => {
    cancelPipeline();
    setView('pipeline');
  }, [cancelPipeline, setView]);

  const handleResetPipeline = useCallback(() => {
    resetPipeline();
    setStepOptions({});
    setStepOutputs({});
    setConfigExpanded({});
  }, [resetPipeline]);

  const handleStepClick = useCallback(
    (stepIndex: number) => {
      const status = stepStatus[stepIndex];
      if (status === 'done' || status === 'skipped' || status === 'failed') {
        // Scroll into view only - we just set the current step for viewing
        advanceToStep(stepIndex);
      }
    },
    [stepStatus, advanceToStep],
  );

  // --------------------------------------------------
  // Check if pipeline is fully complete
  // --------------------------------------------------
  const allStepsDone = useMemo(() => {
    for (let i = 1; i <= totalSteps; i++) {
      const s = stepStatus[i];
      if (s !== 'done' && s !== 'skipped') return false;
    }
    return totalSteps > 0;
  }, [stepStatus, totalSteps]);

  // Build a final ToolOutput for the last step (for PreviewPanel / DownloadPanel)
  const finalOutput = useMemo((): ToolOutput | null => {
    if (!allStepsDone) return null;

    // Walk backwards to find the last 'done' step with an output
    for (let i = totalSteps; i >= 1; i--) {
      if (stepOutputs[i]) return stepOutputs[i];
    }

    // Fallback: wrap the last successful bytes
    const lastBytes = getLastSuccessfulOutput();
    if (lastBytes) {
      return {
        files: [{ name: 'pipeline-output.pdf', bytes: lastBytes, pageCount: estimatePageCount(lastBytes) }],
        processingTime: 0,
      };
    }

    return null;
  }, [allStepsDone, totalSteps, stepOutputs, getLastSuccessfulOutput]);

  // --------------------------------------------------
  // Render: Sidebar
  // --------------------------------------------------

  const renderSidebar = () => (
    <aside className="flex w-64 flex-shrink-0 flex-col border-r border-gray-200 bg-gray-50">
      {/* Header */}
      <div className="border-b border-gray-200 px-4 py-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Pipeline Steps</h2>
      </div>

      {/* Step list */}
      <nav className="flex-1 overflow-y-auto px-3 py-3">
        <ol className="space-y-1">
          {/* Step 0: Upload */}
          <li>
            <button
              type="button"
              onClick={() => handleStepClick(0)}
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors ${
                currentStep === 0
                  ? 'bg-indigo-50 text-indigo-700 font-medium'
                  : stepStatus[0] === 'done'
                    ? 'text-gray-700 hover:bg-gray-100 cursor-pointer'
                    : 'text-gray-400 cursor-default'
              }`}
              disabled={currentStep === 0}
            >
              <StepStatusIndicator status={stepStatus[0] ?? (currentStep === 0 ? 'configuring' : 'pending')} />
              <div className="flex items-center gap-2">
                <Upload className="h-4 w-4" />
                <span>Upload File</span>
              </div>
            </button>
          </li>

          {/* Tool steps */}
          {steps.map((step) => {
            const status: StepStatus = stepStatus[step.index] ?? 'pending';
            const isCurrent = currentStep === step.index;
            const Icon = step.iconName ? getToolIcon(step.iconName) : FileText;

            return (
              <li key={step.index}>
                <button
                  type="button"
                  onClick={() => handleStepClick(step.index)}
                  className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors ${
                    isCurrent
                      ? 'bg-indigo-50 text-indigo-700 font-medium'
                      : status === 'done' || status === 'skipped' || status === 'failed'
                        ? 'text-gray-700 hover:bg-gray-100 cursor-pointer'
                        : 'text-gray-400 cursor-default'
                  }`}
                  disabled={status === 'pending' && !isCurrent}
                >
                  <StepStatusIndicator status={status} />
                  <div className="flex items-center gap-2 truncate">
                    <Icon className="h-4 w-4 flex-shrink-0" />
                    <span className="truncate">{step.name}</span>
                  </div>
                </button>
              </li>
            );
          })}
        </ol>
      </nav>

      {/* Cancel button */}
      <div className="border-t border-gray-200 px-4 py-4">
        <button
          type="button"
          onClick={handleCancelPipeline}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50"
        >
          <XCircle className="h-4 w-4" />
          Cancel Pipeline
        </button>
      </div>
    </aside>
  );

  // --------------------------------------------------
  // Render: Step 0 – File Upload
  // --------------------------------------------------

  const renderFileUpload = () => (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900">Upload Your PDF</h2>
        <p className="mt-1 text-sm text-gray-500">
          Select a PDF file to process through your pipeline of {totalSteps} step
          {totalSteps !== 1 ? 's' : ''}.
        </p>
      </div>

      <FileDropZone onFilesLoaded={handleFilesLoaded} />
    </div>
  );

  // --------------------------------------------------
  // Render: Tool step – configuring
  // --------------------------------------------------

  const renderConfiguring = (stepIndex: number) => {
    const toolId = selectedTools[stepIndex - 1];
    const tool = TOOL_MAP[toolId];
    const inputBytes = getStepInput(stepIndex);
    const pageCount = inputBytes ? estimatePageCount(inputBytes) : 0;
    const fileSize = inputBytes ? inputBytes.byteLength : 0;
    const options = stepOptions[stepIndex] ?? {};
    const isExpanded = configExpanded[stepIndex] ?? true;

    return (
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h2 className="text-xl font-semibold text-gray-900">
            Step {stepIndex} of {totalSteps}: {tool?.name ?? toolId}
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            Configure this step and click Apply to process.
          </p>
        </div>

        {/* Input info */}
        <div className="flex items-center gap-4 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
          <FileText className="h-5 w-5 text-gray-400" />
          <div className="text-sm text-gray-700">
            <span className="font-medium">Input:</span>{' '}
            ~{pageCount} page{pageCount !== 1 ? 's' : ''}, {formatFileSize(fileSize)}
          </div>
        </div>

        {/* Configuration section */}
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
          <button
            type="button"
            onClick={() =>
              setConfigExpanded((prev) => ({ ...prev, [stepIndex]: !isExpanded }))
            }
            className="flex w-full items-center justify-between px-5 py-4 text-left"
          >
            <span className="text-sm font-medium text-gray-900">Configuration</span>
            <ChevronRight
              className={`h-4 w-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
            />
          </button>

          {isExpanded && (
            <div className="border-t border-gray-100 px-5 py-4">
              <PipelineStepControls
                toolId={toolId}
                options={options}
                onChange={(opts) =>
                  setStepOptions((prev) => ({ ...prev, [stepIndex]: opts }))
                }
              />
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => handleApply(stepIndex)}
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-700"
          >
            <Play className="h-4 w-4" />
            Apply
          </button>

          <button
            type="button"
            onClick={() => handleSkip(stepIndex)}
            className="inline-flex items-center gap-2 rounded-xl border border-gray-300 bg-white px-5 py-2.5 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50"
          >
            <SkipForward className="h-4 w-4" />
            Skip this step
          </button>
        </div>
      </div>
    );
  };

  // --------------------------------------------------
  // Render: Tool step – processing
  // --------------------------------------------------

  const renderProcessing = (stepIndex: number) => {
    const tool = TOOL_MAP[selectedTools[stepIndex - 1]];
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">
            Processing: {tool?.name ?? selectedTools[stepIndex - 1]}
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            Processing step {stepIndex} of {totalSteps}...
          </p>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <ProgressBar />
          <p className="mt-4 text-center text-sm text-gray-500">
            Please wait while the operation completes.
          </p>
        </div>
      </div>
    );
  };

  // --------------------------------------------------
  // Render: Tool step – done (intermediate)
  // --------------------------------------------------

  const renderStepDone = (stepIndex: number) => {
    const toolId = selectedTools[stepIndex - 1];
    const tool = TOOL_MAP[toolId];
    const resultBytes = intermediateResults[stepIndex];
    const pageCount = resultBytes ? estimatePageCount(resultBytes) : 0;
    const fileSize = resultBytes ? resultBytes.byteLength : 0;
    const isLastStep = stepIndex === totalSteps;

    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">
            Step {stepIndex}: {tool?.name ?? toolId}
          </h2>
          <div className="mt-2 flex items-center gap-2 text-sm text-green-600">
            <Check className="h-4 w-4" />
            <span>Completed successfully</span>
          </div>
        </div>

        {/* Output info */}
        <div className="rounded-xl border border-green-200 bg-green-50 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100">
              <Check className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-green-900">
                Output: ~{pageCount} page{pageCount !== 1 ? 's' : ''}, {formatFileSize(fileSize)}
              </p>
              {stepOutputs[stepIndex]?.processingTime != null && (
                <p className="text-xs text-green-700">
                  Processed in {(stepOutputs[stepIndex].processingTime / 1000).toFixed(1)}s
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Actions */}
        {!isLastStep && (
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => handleContinue(stepIndex)}
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-700"
            >
              Continue to Next Step
              <ChevronRight className="h-4 w-4" />
            </button>

            <button
              type="button"
              onClick={() => handleReconfigure(stepIndex)}
              className="inline-flex items-center gap-2 rounded-xl border border-gray-300 bg-white px-5 py-2.5 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50"
            >
              <RefreshCw className="h-4 w-4" />
              Reconfigure
            </button>

            <button
              type="button"
              onClick={() => handleSkip(stepIndex)}
              className="inline-flex items-center gap-2 rounded-xl border border-gray-300 bg-white px-5 py-2.5 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50"
            >
              <SkipForward className="h-4 w-4" />
              Skip &amp; Continue
            </button>
          </div>
        )}
      </div>
    );
  };

  // --------------------------------------------------
  // Render: Tool step – failed
  // --------------------------------------------------

  const renderFailed = (stepIndex: number) => {
    const toolId = selectedTools[stepIndex - 1];
    const tool = TOOL_MAP[toolId];
    const errorMsg = stepErrors[stepIndex] ?? 'An unknown error occurred.';

    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">
            Step {stepIndex}: {tool?.name ?? toolId}
          </h2>
          <div className="mt-2 flex items-center gap-2 text-sm text-red-600">
            <XCircle className="h-4 w-4" />
            <span>Step failed</span>
          </div>
        </div>

        {/* Error details */}
        <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-4">
          <div className="flex gap-3">
            <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-500" />
            <div>
              <p className="text-sm font-medium text-red-900">Error</p>
              <p className="mt-1 text-sm text-red-700">{errorMsg}</p>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => handleRetry(stepIndex)}
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-700"
          >
            <RefreshCw className="h-4 w-4" />
            Retry
          </button>

          <button
            type="button"
            onClick={() => handleSkip(stepIndex)}
            className="inline-flex items-center gap-2 rounded-xl border border-gray-300 bg-white px-5 py-2.5 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50"
          >
            <SkipForward className="h-4 w-4" />
            Skip
          </button>

          <button
            type="button"
            onClick={handleCancelPipeline}
            className="inline-flex items-center gap-2 rounded-xl border border-red-300 bg-white px-5 py-2.5 text-sm font-medium text-red-700 shadow-sm transition-colors hover:bg-red-50"
          >
            <XCircle className="h-4 w-4" />
            Cancel Pipeline
          </button>
        </div>
      </div>
    );
  };

  // --------------------------------------------------
  // Render: Pipeline Summary (after all steps done)
  // --------------------------------------------------

  const renderPipelineSummary = () => {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Pipeline Complete</h2>
          <p className="mt-1 text-sm text-gray-500">
            All {totalSteps} step{totalSteps !== 1 ? 's' : ''} have been processed.
          </p>
        </div>

        {/* Step summary list */}
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-100 px-5 py-3">
            <h3 className="text-sm font-medium text-gray-900">Summary</h3>
          </div>
          <ul className="divide-y divide-gray-100">
            {steps.map((step) => {
              const status: StepStatus = stepStatus[step.index] ?? 'pending';
              const Icon = step.iconName ? getToolIcon(step.iconName) : FileText;
              const statusLabel =
                status === 'done'
                  ? 'Completed'
                  : status === 'skipped'
                    ? 'Skipped'
                    : status === 'failed'
                      ? 'Failed'
                      : status;

              const statusColor =
                status === 'done'
                  ? 'text-green-600'
                  : status === 'skipped'
                    ? 'text-gray-500'
                    : status === 'failed'
                      ? 'text-red-600'
                      : 'text-gray-400';

              return (
                <li key={step.index} className="flex items-center gap-3 px-5 py-3">
                  <StepStatusIndicator status={status} />
                  <Icon className="h-4 w-4 text-gray-500" />
                  <span className="flex-1 text-sm text-gray-900">{step.name}</span>
                  <span className={`text-xs font-medium ${statusColor}`}>{statusLabel}</span>
                </li>
              );
            })}
          </ul>
        </div>

        {/* Preview & Download */}
        {finalOutput && (
          <div className="space-y-4">
            <PreviewPanel result={finalOutput} />
            <DownloadPanel result={finalOutput} onReset={handleResetPipeline} />
          </div>
        )}

        {/* Process another */}
        <div className="flex items-center gap-3 border-t border-gray-200 pt-6">
          <button
            type="button"
            onClick={handleResetPipeline}
            className="inline-flex items-center gap-2 rounded-xl border border-gray-300 bg-white px-5 py-2.5 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50"
          >
            <RefreshCw className="h-4 w-4" />
            Process Another File
          </button>
        </div>
      </div>
    );
  };

  // --------------------------------------------------
  // Render: Main content area dispatcher
  // --------------------------------------------------

  const renderMainContent = () => {
    // If all steps done, show summary
    if (allStepsDone) {
      return renderPipelineSummary();
    }

    // Step 0: file upload
    if (currentStep === 0) {
      return renderFileUpload();
    }

    // Tool steps 1..N
    if (currentStep >= 1 && currentStep <= totalSteps) {
      const status: StepStatus = stepStatus[currentStep] ?? 'pending';

      switch (status) {
        case 'configuring':
          return renderConfiguring(currentStep);
        case 'processing':
          return renderProcessing(currentStep);
        case 'done':
          // If it's the last step and all done, we'd have caught it above.
          // But if only this step is done (not all), show intermediate result.
          return renderStepDone(currentStep);
        case 'failed':
          return renderFailed(currentStep);
        case 'skipped':
          // If we're viewing a skipped step (review), show a note
          return (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-gray-900">
                Step {currentStep}: {TOOL_MAP[selectedTools[currentStep - 1]]?.name ?? selectedTools[currentStep - 1]}
              </h2>
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <SkipForward className="h-4 w-4" />
                <span>This step was skipped.</span>
              </div>
            </div>
          );
        case 'pending':
        default:
          // Should not normally be pending when it's the current step,
          // but in case of a race, just show configuring
          return renderConfiguring(currentStep);
      }
    }

    // Fallback
    return renderFileUpload();
  };

  // --------------------------------------------------
  // Root layout
  // --------------------------------------------------

  return (
    <div className="flex h-full min-h-0">
      {renderSidebar()}

      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-2xl px-6 py-8">
          {renderMainContent()}
        </div>
      </main>
    </div>
  );
}

export default PipelineExecution;
