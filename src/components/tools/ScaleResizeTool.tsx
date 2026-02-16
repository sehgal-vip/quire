import { useState, useCallback, useMemo } from 'react';
import type { UploadedFile, ToolOutput } from '@/types';
import { workerClient } from '@/lib/pdf-worker-client';
import { useProcessingStore } from '@/stores/processingStore';
import { FileDropZone } from '@/components/common/FileDropZone';
import { PageSelector } from '@/components/common/PageSelector';
import { ProgressBar } from '@/components/common/ProgressBar';
import { PreviewPanel } from '@/components/common/PreviewPanel';
import { DownloadPanel } from '@/components/common/DownloadPanel';
import { ToolSuggestions } from '@/components/common/ToolSuggestions';
import { Maximize2 } from 'lucide-react';
import toast from 'react-hot-toast';

const PAGE_SIZE_PRESETS: Record<string, { width: number; height: number; label: string }> = {
  A4: { width: 595.28, height: 841.89, label: 'A4 (210x297mm)' },
  Letter: { width: 612, height: 792, label: 'Letter (8.5x11in)' },
  Legal: { width: 612, height: 1008, label: 'Legal (8.5x14in)' },
  A3: { width: 841.89, height: 1190.55, label: 'A3' },
  A5: { width: 419.53, height: 595.28, label: 'A5' },
  Custom: { width: 0, height: 0, label: 'Custom' },
};

type ApplyTo = 'all' | 'selected';

export function ScaleResizeTool() {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [targetSize, setTargetSize] = useState<string>('A4');
  const [customWidth, setCustomWidth] = useState<number>(595);
  const [customHeight, setCustomHeight] = useState<number>(842);
  const [fitContent, setFitContent] = useState(true);
  const [applyTo, setApplyTo] = useState<ApplyTo>('all');
  const [selectedPages, setSelectedPages] = useState<Set<number>>(new Set());
  const [result, setResult] = useState<ToolOutput | null>(null);

  const status = useProcessingStore((s) => s.status);

  const file = files[0] ?? null;

  const analysis = useMemo(() => {
    if (!file) return null;
    return {
      isEncrypted: file.isEncrypted,
      pageCount: file.pageCount,
      hasMixedPageSizes: false,
    };
  }, [file]);

  const resolvedSize = useMemo(() => {
    if (targetSize === 'Custom') {
      return { width: customWidth, height: customHeight };
    }
    const preset = PAGE_SIZE_PRESETS[targetSize];
    return preset ? { width: preset.width, height: preset.height } : { width: 595.28, height: 841.89 };
  }, [targetSize, customWidth, customHeight]);

  const canProcess = useMemo(() => {
    if (!file) return false;
    if (resolvedSize.width <= 0 || resolvedSize.height <= 0) return false;
    if (applyTo === 'selected' && selectedPages.size === 0) return false;
    return true;
  }, [file, resolvedSize, applyTo, selectedPages]);

  const handleFilesLoaded = useCallback((loaded: UploadedFile[]) => {
    setFiles(loaded);
    setSelectedPages(new Set());
    setResult(null);
    useProcessingStore.getState().reset();
  }, []);

  const handleProcess = useCallback(async () => {
    if (!file || !canProcess) return;

    try {
      const output = await workerClient.process('scale', [file.bytes], {
        targetWidth: resolvedSize.width,
        targetHeight: resolvedSize.height,
        fitContent,
        pages: applyTo === 'all' ? undefined : Array.from(selectedPages),
      });
      setResult(output);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      toast.error(message);
    }
  }, [file, canProcess, resolvedSize, fitContent, applyTo, selectedPages]);

  const handleReset = useCallback(() => {
    setFiles([]);
    setTargetSize('A4');
    setCustomWidth(595);
    setCustomHeight(842);
    setFitContent(true);
    setApplyTo('all');
    setSelectedPages(new Set());
    setResult(null);
    useProcessingStore.getState().reset();
  }, []);

  // Result state
  if (result) {
    return (
      <div className="space-y-4">
        <PreviewPanel result={result} originalBytes={file?.bytes} showOriginalToggle />
        <DownloadPanel result={result} onReset={handleReset} />
      </div>
    );
  }


  // Configure and process
  return (
    <div className="space-y-6">
      <FileDropZone onFilesLoaded={handleFilesLoaded} />

      {file && (<>

      <ToolSuggestions analysis={analysis} currentToolId="scale" />

      {/* Top toolbar */}
      <div className="flex items-center justify-end">
        <button
          onClick={handleProcess}
          disabled={!canProcess || status === 'processing'}
          className="flex items-center gap-1.5 px-4 py-1.5 text-sm font-medium bg-indigo-600 dark:bg-indigo-500 text-white rounded-lg hover:bg-indigo-700 dark:hover:bg-indigo-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Maximize2 size={14} />
          {status === 'processing' ? 'Processing...' : 'Resize PDF'}
        </button>
      </div>

      {/* Target size selection */}
      <div className="space-y-2">
        <label htmlFor="target-size" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          Target page size
        </label>
        <select
          id="target-size"
          value={targetSize}
          onChange={(e) => setTargetSize(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none bg-white"
        >
          {Object.entries(PAGE_SIZE_PRESETS).map(([key, preset]) => (
            <option key={key} value={key}>
              {preset.label}
            </option>
          ))}
        </select>
      </div>

      {/* Custom dimensions */}
      {targetSize === 'Custom' && (
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <label htmlFor="custom-width" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Width (points)
            </label>
            <input
              id="custom-width"
              type="number"
              min={1}
              value={customWidth}
              onChange={(e) => setCustomWidth(Number(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="custom-height" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Height (points)
            </label>
            <input
              id="custom-height"
              type="number"
              min={1}
              value={customHeight}
              onChange={(e) => setCustomHeight(Number(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
            />
          </div>
          <p className="col-span-2 text-xs text-gray-400 dark:text-gray-500">
            1 inch = 72 points, 1 mm = 2.835 points
          </p>
        </div>
      )}

      {/* Fit content checkbox */}
      <div className="flex items-start gap-3">
        <input
          id="fit-content"
          type="checkbox"
          checked={fitContent}
          onChange={(e) => setFitContent(e.target.checked)}
          className="mt-0.5 h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
        />
        <div>
          <label htmlFor="fit-content" className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Fit content to new page size
          </label>
          <p className="text-xs text-gray-400 dark:text-gray-500">
            Scale existing content proportionally to fit within the new page dimensions.
            When unchecked, content retains its original size and may be cropped or have extra whitespace.
          </p>
        </div>
      </div>

      {/* Apply to selection */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Apply to</label>
        <div className="flex gap-4">
          <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
            <input
              type="radio"
              name="apply-to"
              value="all"
              checked={applyTo === 'all'}
              onChange={() => setApplyTo('all')}
              className="h-4 w-4 border-gray-300 text-indigo-600 focus:ring-indigo-500"
            />
            All pages
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
            <input
              type="radio"
              name="apply-to"
              value="selected"
              checked={applyTo === 'selected'}
              onChange={() => setApplyTo('selected')}
              className="h-4 w-4 border-gray-300 text-indigo-600 focus:ring-indigo-500"
            />
            Selected pages
          </label>
        </div>
      </div>

      {/* Page selector when "Selected pages" is chosen */}
      {applyTo === 'selected' && (
        <PageSelector
          pageCount={file.pageCount}
          pdfBytes={file.bytes}
          selectedPages={selectedPages}
          onSelectionChange={setSelectedPages}
          overlayType="selected"
        />
      )}

      <ProgressBar />

      {/* Process button */}
      <button
        onClick={handleProcess}
        disabled={!canProcess || status === 'processing'}
        className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 dark:bg-indigo-500 text-white font-medium rounded-lg hover:bg-indigo-700 dark:hover:bg-indigo-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus-ring"
      >
        <Maximize2 size={16} />
        {status === 'processing' ? 'Processing...' : 'Resize PDF'}
      </button>      </>)}
    </div>
  );
}