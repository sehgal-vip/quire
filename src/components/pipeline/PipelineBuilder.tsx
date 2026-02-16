import { useCallback } from 'react';
import {
  Scissors,
  Layers,
  ArrowUpDown,
  Trash2,
  FileOutput,
  FilePlus,
  RotateCw,
  Maximize,
  Hash,
  Type,
  Lock,
  Unlock,
  FileText,
  ScanLine,
  ShieldCheck,
  FileCheck,
  ChevronUp,
  ChevronDown,
  X,
  Play,
  AlertTriangle,
  Info,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { usePipelineStore } from '@/stores/pipelineStore';
import { useAppStore } from '@/stores/appStore';
import { TOOL_MAP } from '@/lib/constants';
import { PIPELINE_PRESETS } from '@/lib/pipeline-presets';
import type { PipelinePreset, ValidationResult } from '@/types';

const iconMap: Record<string, LucideIcon> = {
  Scissors,
  Layers,
  ArrowUpDown,
  Trash2,
  FileOutput,
  FilePlus,
  RotateCw,
  Maximize,
  Hash,
  Type,
  Lock,
  Unlock,
  FileText,
  ScanLine,
  ShieldCheck,
  FileCheck,
};

const presetIconMap: Record<string, LucideIcon> = {
  ScanLine,
  ShieldCheck,
  FileCheck,
  Lock,
};

function getToolIcon(iconName: string): LucideIcon {
  return iconMap[iconName] ?? FileText;
}

function getPresetIcon(iconName: string): LucideIcon {
  return presetIconMap[iconName] ?? FileText;
}

function getWarningStyle(type: ValidationResult['warnings'][number]['type']): string {
  switch (type) {
    case 'error':
      return 'text-red-600 bg-red-50 border-red-200';
    case 'warning':
      return 'text-amber-600 bg-amber-50 border-amber-200';
    case 'suggestion':
      return 'text-blue-600 bg-blue-50 border-blue-200';
    default:
      return 'text-gray-600 bg-gray-50 border-gray-200';
  }
}

function getWarningIcon(type: ValidationResult['warnings'][number]['type']) {
  switch (type) {
    case 'error':
      return <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />;
    case 'warning':
      return <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />;
    case 'suggestion':
      return <Info className="h-3.5 w-3.5 flex-shrink-0" />;
    default:
      return null;
  }
}

export default function PipelineBuilder() {
  const selectedTools = usePipelineStore((s) => s.selectedTools);
  const validation = usePipelineStore((s) => s.validation);
  const isExecuting = usePipelineStore((s) => s.isExecuting);

  const handleLoadPreset = useCallback((preset: PipelinePreset) => {
    usePipelineStore.getState().loadPreset(preset);
  }, []);

  const handleRemoveTool = useCallback((index: number) => {
    usePipelineStore.getState().removeTool(index);
  }, []);

  const handleMoveUp = useCallback((index: number) => {
    if (index > 0) {
      usePipelineStore.getState().reorderTools(index, index - 1);
    }
  }, []);

  const handleMoveDown = useCallback((index: number) => {
    if (index < usePipelineStore.getState().selectedTools.length - 1) {
      usePipelineStore.getState().reorderTools(index, index + 1);
    }
  }, []);

  const handleClear = useCallback(() => {
    usePipelineStore.getState().clearPipeline();
  }, []);

  const handleStart = useCallback(() => {
    usePipelineStore.getState().startPipeline();
    useAppStore.getState().setView('pipeline');
  }, []);

  const canStart = selectedTools.length >= 2 && validation.valid && !isExecuting;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Pipeline Presets Row */}
      <div>
        <h3 className="mb-3 text-sm font-semibold text-gray-700">
          Quick Start Presets
        </h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {PIPELINE_PRESETS.map((preset) => {
            const PresetIcon = getPresetIcon(preset.icon);
            return (
              <button
                key={preset.id}
                onClick={() => handleLoadPreset(preset)}
                className="group flex flex-col items-start gap-2 rounded-xl border border-gray-200 bg-white p-3 text-left shadow-sm transition-all hover:border-indigo-300 hover:shadow-md"
              >
                <div className="flex items-center gap-2">
                  <PresetIcon className="h-4 w-4 text-indigo-600" />
                  <span className="text-sm font-medium text-gray-900">
                    {preset.name}
                  </span>
                </div>
                <p className="text-xs leading-relaxed text-gray-500">
                  {preset.description}
                </p>
                <div className="flex flex-wrap gap-1">
                  {preset.tools.map((toolId) => {
                    const tool = TOOL_MAP[toolId];
                    return (
                      <span
                        key={toolId}
                        className="inline-block rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-600 group-hover:bg-indigo-50 group-hover:text-indigo-700"
                      >
                        {tool?.name ?? toolId}
                      </span>
                    );
                  })}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Pipeline List */}
      <div>
        <h3 className="mb-3 text-sm font-semibold text-gray-700">
          Pipeline Steps
          {selectedTools.length > 0 && (
            <span className="ml-2 text-xs font-normal text-gray-400">
              ({selectedTools.length} tool{selectedTools.length !== 1 ? 's' : ''})
            </span>
          )}
        </h3>
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
          {selectedTools.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Layers className="mb-3 h-8 w-8 text-gray-300" />
              <p className="text-sm text-gray-400">
                Select tools from the grid below to build your pipeline
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-gray-100">
              {selectedTools.map((toolId, index) => {
                const tool = TOOL_MAP[toolId];
                const ToolIcon = tool ? getToolIcon(tool.icon) : FileText;
                const stepWarnings = validation.warnings.filter((w) =>
                  w.message.toLowerCase().includes(tool?.name?.toLowerCase() ?? '')
                );

                return (
                  <li key={`${toolId}-${index}`}>
                    <div className="flex items-center gap-3 px-4 py-3">
                      {/* Step number */}
                      <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-semibold text-indigo-700">
                        {index + 1}
                      </span>

                      {/* Tool icon + name */}
                      <div className="flex min-w-0 flex-1 items-center gap-2">
                        <ToolIcon className="h-4 w-4 flex-shrink-0 text-gray-500" />
                        <span className="truncate text-sm font-medium text-gray-900">
                          {tool?.name ?? toolId}
                        </span>
                        {tool?.category && (
                          <span
                            className="rounded-full px-2 py-0.5 text-[10px] font-medium"
                            style={{
                              backgroundColor: `${tool.categoryColor}15`,
                              color: tool.categoryColor,
                            }}
                          >
                            {tool.category}
                          </span>
                        )}
                      </div>

                      {/* Reorder & remove buttons */}
                      <div className="flex flex-shrink-0 items-center gap-1">
                        <button
                          onClick={() => handleMoveUp(index)}
                          disabled={index === 0}
                          className="rounded p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 disabled:cursor-not-allowed disabled:opacity-30"
                          aria-label="Move up"
                        >
                          <ChevronUp className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleMoveDown(index)}
                          disabled={index === selectedTools.length - 1}
                          className="rounded p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 disabled:cursor-not-allowed disabled:opacity-30"
                          aria-label="Move down"
                        >
                          <ChevronDown className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleRemoveTool(index)}
                          className="ml-1 rounded p-1 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-500"
                          aria-label="Remove"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    {/* Inline validation warnings for this step */}
                    {stepWarnings.length > 0 && (
                      <div className="space-y-1 px-4 pb-3">
                        {stepWarnings.map((warning, wIdx) => (
                          <div
                            key={wIdx}
                            className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs ${getWarningStyle(warning.type)}`}
                          >
                            {getWarningIcon(warning.type)}
                            <span>{warning.message}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Global validation warnings (not tied to a specific step) */}
        {validation.warnings.length > 0 && selectedTools.length > 0 && (
          <div className="mt-3 space-y-1.5">
            {validation.warnings
              .filter(
                (w) =>
                  !selectedTools.some((toolId) => {
                    const tool = TOOL_MAP[toolId];
                    return (
                      tool &&
                      w.message.toLowerCase().includes(tool.name.toLowerCase())
                    );
                  })
              )
              .map((warning, idx) => (
                <div
                  key={idx}
                  className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs ${getWarningStyle(warning.type)}`}
                >
                  {getWarningIcon(warning.type)}
                  <span>{warning.message}</span>
                </div>
              ))}
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex items-center justify-end gap-3">
        <button
          onClick={handleClear}
          disabled={selectedTools.length === 0 || isExecuting}
          className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Clear
        </button>
        <button
          onClick={handleStart}
          disabled={!canStart}
          className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-indigo-400 disabled:opacity-70"
        >
          <Play className="h-4 w-4" />
          Start Pipeline
        </button>
      </div>
    </div>
  );
}
