import { useState, useCallback, useMemo } from 'react';
import type { UploadedFile, ToolOutput } from '@/types';
import { workerClient } from '@/lib/pdf-worker-client';
import { useProcessingStore } from '@/stores/processingStore';
import { FileDropZone } from '@/components/common/FileDropZone';
import { ProgressBar } from '@/components/common/ProgressBar';
import { PreviewPanel } from '@/components/common/PreviewPanel';
import { DownloadPanel } from '@/components/common/DownloadPanel';
import { ToolSuggestions } from '@/components/common/ToolSuggestions';
import { FilePlus } from 'lucide-react';
import toast from 'react-hot-toast';

type Position = 'beginning' | 'end' | 'before' | 'after';

const PAGE_SIZE_PRESETS: Record<string, { width: number; height: number }> = {
  'a4': { width: 595.28, height: 841.89 },
  'letter': { width: 612, height: 792 },
  'legal': { width: 612, height: 1008 },
  'a3': { width: 841.89, height: 1190.55 },
  'a5': { width: 419.53, height: 595.28 },
};

const PAGE_SIZE_OPTIONS = [
  { value: 'match', label: 'Match first page' },
  { value: 'a4', label: 'A4 (210x297mm)' },
  { value: 'letter', label: 'Letter (8.5x11in)' },
  { value: 'legal', label: 'Legal (8.5x14in)' },
  { value: 'a3', label: 'A3 (297x420mm)' },
  { value: 'a5', label: 'A5 (148x210mm)' },
  { value: 'custom', label: 'Custom' },
];

export function AddBlankPagesTool() {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [position, setPosition] = useState<Position>('end');
  const [targetPage, setTargetPage] = useState(1);
  const [count, setCount] = useState(1);
  const [pageSize, setPageSize] = useState('match');
  const [customWidth, setCustomWidth] = useState(595.28);
  const [customHeight, setCustomHeight] = useState(841.89);
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

  const dimensions = useMemo(() => {
    if (pageSize === 'custom') {
      return { width: customWidth, height: customHeight };
    }
    if (pageSize === 'match') {
      return { width: 595.28, height: 841.89 };
    }
    return PAGE_SIZE_PRESETS[pageSize] ?? { width: 595.28, height: 841.89 };
  }, [pageSize, customWidth, customHeight]);

  const canProcess = useMemo(() => {
    if (!file) return false;
    if (count < 1 || count > 100) return false;
    if (pageSize === 'custom' && (customWidth <= 0 || customHeight <= 0)) return false;
    if ((position === 'before' || position === 'after') && (targetPage < 1 || targetPage > file.pageCount)) return false;
    return true;
  }, [file, count, pageSize, customWidth, customHeight, position, targetPage]);

  const handleFilesLoaded = useCallback((loaded: UploadedFile[]) => {
    setFiles(loaded);
    setResult(null);
    setTargetPage(1);
    useProcessingStore.getState().reset();
  }, []);

  const handleProcess = useCallback(async () => {
    if (!file || !canProcess) return;

    try {
      const output = await workerClient.process('add-blank-pages', [file.bytes], {
        position,
        targetPage: targetPage - 1,
        count,
        width: dimensions.width,
        height: dimensions.height,
      });
      setResult(output);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      toast.error(message);
    }
  }, [file, canProcess, position, targetPage, count, dimensions]);

  const handleReset = useCallback(() => {
    setFiles([]);
    setPosition('end');
    setTargetPage(1);
    setCount(1);
    setPageSize('match');
    setCustomWidth(595.28);
    setCustomHeight(841.89);
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

      <ToolSuggestions analysis={analysis} currentToolId="add-blank-pages" />

      {/* Top toolbar */}
      <div className="flex items-center justify-end">
        <button
          onClick={handleProcess}
          disabled={!canProcess || status === 'processing'}
          className="flex items-center gap-1.5 px-4 py-1.5 text-sm font-medium bg-indigo-600 dark:bg-indigo-500 text-white rounded-lg hover:bg-indigo-700 dark:hover:bg-indigo-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <FilePlus size={14} />
          {status === 'processing' ? 'Processing...' : `Add ${count} Blank Page${count !== 1 ? 's' : ''}`}
        </button>
      </div>

      {/* Position selector */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Insert position</label>
        <div className="flex flex-wrap gap-2">
          {([
            { value: 'beginning', label: 'At beginning' },
            { value: 'end', label: 'At end' },
            { value: 'before', label: 'Before page' },
            { value: 'after', label: 'After page' },
          ] as const).map((opt) => (
            <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="position"
                value={opt.value}
                checked={position === opt.value}
                onChange={() => setPosition(opt.value)}
                className="text-indigo-600 focus:ring-indigo-500"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">{opt.label}</span>
            </label>
          ))}
        </div>

        {(position === 'before' || position === 'after') && (
          <div className="mt-2">
            <label htmlFor="target-page" className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
              Page number (1-{file.pageCount})
            </label>
            <input
              id="target-page"
              type="number"
              min={1}
              max={file.pageCount}
              value={targetPage}
              onChange={(e) => setTargetPage(Math.max(1, Math.min(file.pageCount, parseInt(e.target.value, 10) || 1)))}
              className="w-24 px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
            />
          </div>
        )}
      </div>

      {/* Number of blank pages */}
      <div className="space-y-2">
        <label htmlFor="blank-count" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          Number of blank pages
        </label>
        <input
          id="blank-count"
          type="number"
          min={1}
          max={100}
          value={count}
          onChange={(e) => setCount(Math.max(1, Math.min(100, parseInt(e.target.value, 10) || 1)))}
          className="w-24 px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
        />
        <p className="text-xs text-gray-400 dark:text-gray-500">Between 1 and 100 blank pages.</p>
      </div>

      {/* Page size */}
      <div className="space-y-2">
        <label htmlFor="page-size" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          Page size
        </label>
        <select
          id="page-size"
          value={pageSize}
          onChange={(e) => setPageSize(e.target.value)}
          className="w-64 px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none bg-white"
        >
          {PAGE_SIZE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>

        {pageSize === 'custom' && (
          <div className="flex items-center gap-3 mt-2">
            <div>
              <label htmlFor="custom-width" className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                Width (pt)
              </label>
              <input
                id="custom-width"
                type="number"
                min={1}
                value={customWidth}
                onChange={(e) => setCustomWidth(parseFloat(e.target.value) || 0)}
                className="w-28 px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
              />
            </div>
            <span className="text-gray-400 dark:text-gray-500 mt-5">x</span>
            <div>
              <label htmlFor="custom-height" className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                Height (pt)
              </label>
              <input
                id="custom-height"
                type="number"
                min={1}
                value={customHeight}
                onChange={(e) => setCustomHeight(parseFloat(e.target.value) || 0)}
                className="w-28 px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
              />
            </div>
          </div>
        )}
      </div>

      {/* Summary */}
      <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3 text-sm text-gray-600 dark:text-gray-400">
        Adding <span className="font-semibold">{count}</span> blank page{count !== 1 ? 's' : ''}{' '}
        {position === 'beginning' && 'at the beginning'}
        {position === 'end' && 'at the end'}
        {position === 'before' && `before page ${targetPage}`}
        {position === 'after' && `after page ${targetPage}`}
        {' '}({Math.round(dimensions.width)} x {Math.round(dimensions.height)} pt).
        Result will have <span className="font-semibold">{file.pageCount + count}</span> pages.
      </div>

      <ProgressBar />

      {/* Process button */}
      <button
        onClick={handleProcess}
        disabled={!canProcess || status === 'processing'}
        className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 dark:bg-indigo-500 text-white font-medium rounded-lg hover:bg-indigo-700 dark:hover:bg-indigo-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus-ring"
      >
        <FilePlus size={16} />
        {status === 'processing' ? 'Processing...' : `Add ${count} Blank Page${count !== 1 ? 's' : ''}`}
      </button>      </>)}
    </div>
  );
}