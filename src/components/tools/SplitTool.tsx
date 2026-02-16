import { useState, useCallback, useMemo } from 'react';
import type { UploadedFile, ToolOutput } from '@/types';
import { workerClient } from '@/lib/pdf-worker-client';
import { useProcessingStore } from '@/stores/processingStore';
import { parsePageRange } from '@/lib/page-range-parser';
import { FileDropZone } from '@/components/common/FileDropZone';
import { PageSelector } from '@/components/common/PageSelector';
import { ProgressBar } from '@/components/common/ProgressBar';
import { PreviewPanel } from '@/components/common/PreviewPanel';
import { DownloadPanel } from '@/components/common/DownloadPanel';
import { ToolSuggestions } from '@/components/common/ToolSuggestions';
import { Scissors } from 'lucide-react';
import toast from 'react-hot-toast';

type SplitMode = 'single' | 'separate';

export function SplitTool() {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [selectedPages, setSelectedPages] = useState<Set<number>>(new Set());
  const [splitMode, setSplitMode] = useState<SplitMode>('single');
  const [rangeText, setRangeText] = useState('');
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

  const separateRanges = useMemo(() => {
    if (splitMode !== 'separate' || !file || !rangeText.trim()) return null;
    const parts = rangeText.split(',').map((s) => s.trim()).filter(Boolean);
    const ranges: number[][] = [];
    for (const part of parts) {
      const parsed = parsePageRange(part, file.pageCount);
      if (parsed.error) return { error: parsed.error, ranges: [] };
      // Convert 1-indexed pages to 0-indexed
      ranges.push(parsed.pages.map((p) => p - 1));
    }
    return { error: null, ranges };
  }, [splitMode, rangeText, file]);

  const canProcess = useMemo(() => {
    if (!file) return false;
    if (splitMode === 'single') return selectedPages.size > 0;
    if (splitMode === 'separate') {
      return separateRanges !== null && !separateRanges.error && separateRanges.ranges.length > 0;
    }
    return false;
  }, [file, splitMode, selectedPages, separateRanges]);

  const handleFilesLoaded = useCallback((loaded: UploadedFile[]) => {
    setFiles(loaded);
    setSelectedPages(new Set());
    setRangeText('');
    setResult(null);
    useProcessingStore.getState().reset();
  }, []);

  const handleProcess = useCallback(async () => {
    if (!file || !canProcess) return;

    let ranges: number[][];
    if (splitMode === 'single') {
      ranges = [Array.from(selectedPages).sort((a, b) => a - b)];
    } else {
      if (!separateRanges || separateRanges.error) return;
      ranges = separateRanges.ranges;
    }

    try {
      const output = await workerClient.process('split', [file.bytes], {
        mode: splitMode,
        ranges,
      });
      setResult(output);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      toast.error(message);
    }
  }, [file, canProcess, splitMode, selectedPages, separateRanges]);

  const handleReset = useCallback(() => {
    setFiles([]);
    setSelectedPages(new Set());
    setSplitMode('single');
    setRangeText('');
    setResult(null);
    useProcessingStore.getState().reset();
  }, []);

  // Result state
  if (result) {
    return (
      <div className="space-y-4">
        <PreviewPanel result={result} />
        <DownloadPanel result={result} onReset={handleReset} />
      </div>
    );
  }


  // Configure and process
  return (
    <div className="space-y-6">
      <FileDropZone onFilesLoaded={handleFilesLoaded} />

      {file && (<>

      <ToolSuggestions analysis={analysis} currentToolId="split" />

      {/* Top toolbar */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {file.pageCount} page{file.pageCount !== 1 ? 's' : ''}
          {splitMode === 'single' && selectedPages.size > 0 && ` — ${selectedPages.size} selected`}
        </p>
        <div className="flex items-center gap-2">
          {splitMode === 'single' && selectedPages.size > 0 && (
            <button
              onClick={() => setSelectedPages(new Set())}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              Reset Selection
            </button>
          )}
          <button
            onClick={handleProcess}
            disabled={!canProcess || status === 'processing'}
            className="flex items-center gap-1.5 px-4 py-1.5 text-sm font-medium bg-indigo-600 dark:bg-indigo-500 text-white rounded-lg hover:bg-indigo-700 dark:hover:bg-indigo-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Scissors size={14} />
            {status === 'processing' ? 'Processing...' : 'Split PDF'}
          </button>
        </div>
      </div>

      {/* Split mode toggle */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Split mode</label>
        <div className="flex gap-2">
          <button
            onClick={() => setSplitMode('single')}
            className={`px-4 py-2 text-sm rounded-lg border transition-colors ${
              splitMode === 'single'
                ? 'bg-indigo-50 border-indigo-300 text-indigo-700 font-medium dark:bg-indigo-950 dark:border-indigo-700 dark:text-indigo-300'
                : 'border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800'
            }`}
          >
            Extract pages
          </button>
          <button
            onClick={() => setSplitMode('separate')}
            className={`px-4 py-2 text-sm rounded-lg border transition-colors ${
              splitMode === 'separate'
                ? 'bg-indigo-50 border-indigo-300 text-indigo-700 font-medium dark:bg-indigo-950 dark:border-indigo-700 dark:text-indigo-300'
                : 'border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800'
            }`}
          >
            Split into ranges
          </button>
        </div>
      </div>

      {/* Page selection based on mode */}
      {splitMode === 'single' && (
        <PageSelector
          pageCount={file.pageCount}
          pdfBytes={file.bytes}
          selectedPages={selectedPages}
          onSelectionChange={setSelectedPages}
          overlayType="selected"
        />
      )}

      {splitMode === 'separate' && (
        <div className="space-y-2">
          <label htmlFor="split-ranges" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Page ranges (comma-separated)
          </label>
          <input
            id="split-ranges"
            type="text"
            value={rangeText}
            onChange={(e) => setRangeText(e.target.value)}
            placeholder="e.g., 1-3, 4-7, 8-end"
            className={`w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none ${
              separateRanges?.error ? 'border-red-300 dark:border-red-700' : 'border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100'
            }`}
          />
          {separateRanges?.error && (
            <p className="text-xs text-red-500 dark:text-red-400">{separateRanges.error}</p>
          )}
          <p className="text-xs text-gray-400 dark:text-gray-500">
            Each comma-separated range will become a separate PDF file. Use "end" for the last page.
          </p>
        </div>
      )}

      <ProgressBar />

      {/* Process button */}
      <button
        onClick={handleProcess}
        disabled={!canProcess || status === 'processing'}
        className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 dark:bg-indigo-500 text-white font-medium rounded-lg hover:bg-indigo-700 dark:hover:bg-indigo-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus-ring"
      >
        <Scissors size={16} />
        {status === 'processing' ? 'Processing...' : 'Split PDF'}
      </button>      </>)}
    </div>
  );
}