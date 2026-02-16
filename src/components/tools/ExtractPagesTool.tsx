import { useState, useCallback } from 'react';
import { FileDropZone } from '@/components/common/FileDropZone';
import { PageSelector } from '@/components/common/PageSelector';
import { ProgressBar } from '@/components/common/ProgressBar';
import { PreviewPanel } from '@/components/common/PreviewPanel';
import { DownloadPanel } from '@/components/common/DownloadPanel';
import { ToolSuggestions } from '@/components/common/ToolSuggestions';
import { workerClient } from '@/lib/pdf-worker-client';
import { useProcessingStore } from '@/stores/processingStore';
import toast from 'react-hot-toast';
import type { UploadedFile, ToolOutput } from '@/types';

export function ExtractPagesTool() {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [selectedPages, setSelectedPages] = useState<Set<number>>(new Set());
  const [extractMode, setExtractMode] = useState<'single' | 'individual'>('single');
  const [result, setResult] = useState<ToolOutput | null>(null);

  const status = useProcessingStore((s) => s.status);

  const file = files[0] ?? null;

  const noneSelected = selectedPages.size === 0;

  const handleFilesLoaded = useCallback((loaded: UploadedFile[]) => {
    setFiles(loaded);
    setSelectedPages(new Set());
    setResult(null);
  }, []);

  const handleProcess = async () => {
    if (!file || noneSelected) return;
    try {
      const output = await workerClient.process('extract', [file.bytes], {
        pages: Array.from(selectedPages).sort((a, b) => a - b),
        mode: extractMode,
      });
      setResult(output);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    }
  };

  const handleReset = () => {
    setFiles([]);
    setSelectedPages(new Set());
    setExtractMode('single');
    setResult(null);
    useProcessingStore.getState().reset();
  };

  const analysis = file
    ? { isEncrypted: file.isEncrypted, pageCount: file.pageCount, hasMixedPageSizes: false }
    : null;

  if (result) {
    return (
      <div className="space-y-6">
        <PreviewPanel result={result} originalBytes={file?.bytes} showOriginalToggle />
        <DownloadPanel result={result} onReset={handleReset} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <FileDropZone onFilesLoaded={handleFilesLoaded} />

      {file && <ToolSuggestions analysis={analysis} currentToolId="extract-pages" />}

      {status === 'processing' && <ProgressBar />}

      {file && (
        <>
          {/* Top toolbar */}
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {file.pageCount} page{file.pageCount !== 1 ? 's' : ''}
              {selectedPages.size > 0 && ` — ${selectedPages.size} selected`}
            </p>
            <div className="flex items-center gap-2">
              {selectedPages.size > 0 && (
                <button
                  onClick={() => setSelectedPages(new Set())}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  Reset Selection
                </button>
              )}
              <button
                onClick={handleProcess}
                disabled={noneSelected || status === 'processing'}
                className="flex items-center gap-1.5 px-4 py-1.5 text-sm font-medium bg-indigo-600 dark:bg-indigo-500 text-white rounded-lg hover:bg-indigo-700 dark:hover:bg-indigo-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {status === 'processing'
                  ? 'Processing...'
                  : noneSelected
                    ? 'Select pages'
                    : `Extract ${selectedPages.size} Page${selectedPages.size !== 1 ? 's' : ''}`}
              </button>
            </div>
          </div>

          <PageSelector
            pageCount={file.pageCount}
            pdfBytes={file.bytes}
            selectedPages={selectedPages}
            onSelectionChange={setSelectedPages}
          />

          {selectedPages.size > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Extract mode
              </label>
              <div className="flex rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                <button
                  onClick={() => setExtractMode('single')}
                  className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
                    extractMode === 'single'
                      ? 'bg-indigo-600 dark:bg-indigo-500 text-white'
                      : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
                >
                  As single PDF
                </button>
                <button
                  onClick={() => setExtractMode('individual')}
                  className={`flex-1 px-4 py-2 text-sm font-medium transition-colors border-l border-gray-200 dark:border-gray-700 ${
                    extractMode === 'individual'
                      ? 'bg-indigo-600 dark:bg-indigo-500 text-white'
                      : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
                >
                  Each page as separate PDF
                </button>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1.5">
                {extractMode === 'single'
                  ? `${selectedPages.size} page${selectedPages.size !== 1 ? 's' : ''} will be combined into one PDF.`
                  : `${selectedPages.size} separate PDF file${selectedPages.size !== 1 ? 's' : ''} will be created.`}
              </p>
            </div>
          )}

          <button
            onClick={handleProcess}
            disabled={noneSelected || status === 'processing'}
            className="w-full py-3 bg-indigo-600 dark:bg-indigo-500 text-white font-medium rounded-lg hover:bg-indigo-700 dark:hover:bg-indigo-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus-ring"
          >
            {status === 'processing'
              ? 'Processing...'
              : noneSelected
                ? 'Select pages to extract'
                : `Extract ${selectedPages.size} Page${selectedPages.size !== 1 ? 's' : ''}`}
          </button>
        </>
      )}
    </div>
  );
}
