import { useAppStore } from '@/stores/appStore';
import { usePipelineStore } from '@/stores/pipelineStore';
import { TOOLS, CATEGORIES } from '@/lib/constants';
import type { PDFTool } from '@/types';
import {
  Scissors, Layers, ArrowUpDown, Trash2, FileOutput, FilePlus,
  RotateCw, Maximize, Hash, Type, Lock, Unlock, FileText,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

const iconMap: Record<string, LucideIcon> = {
  Scissors, Layers, ArrowUpDown, Trash2, FileOutput, FilePlus,
  RotateCw, Maximize, Hash, Type, Lock, Unlock, FileText,
};

const categoryColorMap: Record<string, string> = {
  'blue-500': 'border-l-blue-500',
  'amber-500': 'border-l-amber-500',
  'purple-500': 'border-l-purple-500',
  'red-500': 'border-l-red-500',
  'green-500': 'border-l-green-500',
};

const categoryDotMap: Record<string, string> = {
  'blue-500': 'bg-blue-500',
  'amber-500': 'bg-amber-500',
  'purple-500': 'bg-purple-500',
  'red-500': 'bg-red-500',
  'green-500': 'bg-green-500',
};

const categoryIconColorMap: Record<string, string> = {
  'blue-500': 'text-blue-500',
  'amber-500': 'text-amber-500',
  'purple-500': 'text-purple-500',
  'red-500': 'text-red-500',
  'green-500': 'text-green-500',
};

export function ToolGrid() {
  const { pipelineMode, setView, togglePipelineMode } = useAppStore();
  const pipelineSelectedTools = usePipelineStore((s) => s.selectedTools);

  const grouped = Object.entries(CATEGORIES).map(([key, cat]) => ({
    key,
    ...cat,
    tools: TOOLS.filter((t) => t.category === key),
  }));

  const handleToolClick = (tool: PDFTool) => {
    if (pipelineMode) {
      if (!tool.pipelineCompatible) return;
      // Toggle in pipeline store: if already present (last occurrence), remove it; otherwise add
      const idx = pipelineSelectedTools.lastIndexOf(tool.id);
      if (idx >= 0) {
        usePipelineStore.getState().removeTool(idx);
      } else {
        usePipelineStore.getState().addTool(tool.id);
      }
    } else {
      setView('tool', tool.id);
    }
  };

  const handleStartPipeline = () => {
    usePipelineStore.getState().startPipeline();
    setView('pipeline');
  };

  return (
    <div>
      {/* Mode Toggle */}
      <div className="flex justify-center mb-6">
        <div className="inline-flex rounded-lg border border-gray-200 dark:border-gray-700 p-1 bg-gray-50 dark:bg-gray-800">
          <button
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              !pipelineMode ? 'bg-white dark:bg-gray-700 shadow-sm text-gray-900 dark:text-gray-100' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
            onClick={() => { if (pipelineMode) { togglePipelineMode(); usePipelineStore.getState().clearPipeline(); } }}
          >
            Single Tool
          </button>
          <button
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              pipelineMode ? 'bg-white dark:bg-gray-700 shadow-sm text-gray-900 dark:text-gray-100' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
            onClick={() => { if (!pipelineMode) togglePipelineMode(); }}
          >
            Pipeline
          </button>
        </div>
      </div>

      {/* Pipeline selection summary */}
      {pipelineMode && pipelineSelectedTools.length > 0 && (
        <div className="mb-4 p-3 bg-indigo-50 dark:bg-indigo-950 rounded-lg flex items-center justify-between">
          <span className="text-sm text-indigo-700 dark:text-indigo-300">
            {pipelineSelectedTools.length} tool{pipelineSelectedTools.length !== 1 ? 's' : ''} selected
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => usePipelineStore.getState().clearPipeline()}
              className="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              Clear
            </button>
            <button
              onClick={() => setView('pipeline')}
              className="px-4 py-1.5 text-sm text-indigo-600 dark:text-indigo-400 border border-indigo-300 dark:border-indigo-700 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900 transition-colors"
            >
              Configure
            </button>
            <button
              onClick={handleStartPipeline}
              className="px-4 py-1.5 bg-indigo-600 dark:bg-indigo-500 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 dark:hover:bg-indigo-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={pipelineSelectedTools.length < 2}
            >
              Start Pipeline
            </button>
          </div>
        </div>
      )}

      {/* Tool Categories */}
      {grouped.map((group) => (
        <div key={group.key} className="mb-8">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-3 flex items-center gap-2">
            <span className={`w-2.5 h-2.5 rounded-full ${categoryDotMap[group.color]}`} />
            {group.label}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {group.tools.map((tool) => {
              const Icon = iconMap[tool.icon];
              const pipelineIdx = pipelineSelectedTools.indexOf(tool.id);
              const isSelected = pipelineIdx >= 0;
              const isDisabled = pipelineMode && !tool.pipelineCompatible;
              const isMaxed = pipelineMode && pipelineSelectedTools.length >= 5 && !isSelected;

              return (
                <button
                  key={tool.id}
                  onClick={() => handleToolClick(tool)}
                  disabled={isDisabled || isMaxed}
                  className={`
                    relative text-left p-5 bg-white dark:bg-gray-800 rounded-xl shadow-sm border-l-4
                    ${categoryColorMap[tool.categoryColor]}
                    transition-all duration-150
                    ${isDisabled || isMaxed ? 'opacity-50 cursor-not-allowed' : 'hover:-translate-y-0.5 hover:shadow-md cursor-pointer'}
                    ${isSelected ? 'ring-2 ring-indigo-500' : ''}
                    focus-ring
                  `}
                  aria-label={`${tool.name}${isDisabled ? ' (not available in pipeline)' : ''}`}
                  title={isDisabled ? 'Not available in pipeline mode' : isMaxed ? 'Pipeline is limited to 5 tools' : ''}
                >
                  {isSelected && (
                    <span className="absolute top-2 right-2 w-6 h-6 bg-indigo-600 text-white text-xs font-bold rounded-full flex items-center justify-center">
                      {pipelineIdx + 1}
                    </span>
                  )}
                  <div className="flex items-start gap-3">
                    {Icon && <Icon size={24} className={`${categoryIconColorMap[tool.categoryColor]} shrink-0 mt-0.5`} />}
                    <div>
                      <h3 className="font-medium text-gray-900 dark:text-gray-100">{tool.name}</h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{tool.description}</p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
