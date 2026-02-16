import { useState, useCallback } from 'react';
import { FileDropZone } from '@/components/common/FileDropZone';
import { PageSelector } from '@/components/common/PageSelector';
import { ProgressBar } from '@/components/common/ProgressBar';
import { PreviewPanel } from '@/components/common/PreviewPanel';
import { DownloadPanel } from '@/components/common/DownloadPanel';
import { ToolSuggestions } from '@/components/common/ToolSuggestions';
import { workerClient } from '@/lib/pdf-worker-client';
import { useProcessingStore } from '@/stores/processingStore';
import { ERRORS } from '@/lib/error-messages';
import toast from 'react-hot-toast';
import type { UploadedFile, ToolOutput } from '@/types';

export function DeletePagesTool() {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [selectedPages, setSelectedPages] = useState<Set<number>>(new Set());
  const [result, setResult] = useState<ToolOutput | null>(null);

  const status = useProcessingStore((s) => s.status);

  const file = files[0] ?? null;

  const allSelected = file !== null && selectedPages.size === file.pageCount;
  const noneSelected = selectedPages.size === 0;

  const handleFilesLoaded = useCallback((loaded: UploadedFile[]) => {
    setFiles(loaded);
    setSelectedPages(new Set());
    setResult(null);
  }, []);

  const handleProcess = async () => {
    if (!file || noneSelected || allSelected) return;
    try {
      const output = await workerClient.process('delete', [file.bytes], {
        pagesToDelete: Array.from(selectedPages),
      });
      setResult(output);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    }
  };

  const handleReset = () => {
    setFiles([]);
    setSelectedPages(new Set());
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

      {file && <ToolSuggestions analysis={analysis} currentToolId="delete-pages" />}

      {status === 'processing' && <ProgressBar />}

      {file && (
        <>
          {/* Top toolbar */}
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {file.pageCount} page{file.pageCount !== 1 ? 's' : ''}
              {selectedPages.size > 0 && ` — ${selectedPages.size} selected for deletion`}
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
                disabled={noneSelected || allSelected || status === 'processing'}
                className="flex items-center gap-1.5 px-4 py-1.5 text-sm font-medium bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {status === 'processing'
                  ? 'Processing...'
                  : noneSelected
                    ? 'Select pages'
                    : `Delete ${selectedPages.size} Page${selectedPages.size !== 1 ? 's' : ''}`}
              </button>
            </div>
          </div>

          <PageSelector
            pageCount={file.pageCount}
            pdfBytes={file.bytes}
            selectedPages={selectedPages}
            onSelectionChange={setSelectedPages}
            overlayType="delete"
          />

          {selectedPages.size > 0 && (
            <div className="text-sm text-gray-700 dark:text-gray-300">
              Delete{' '}
              <span className="font-semibold text-red-600 dark:text-red-400">{selectedPages.size}</span>
              {' '}of{' '}
              <span className="font-semibold">{file.pageCount}</span>
              {' '}page{selectedPages.size !== 1 ? 's' : ''}?
            </div>
          )}

          {allSelected && (
            <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2">
              {ERRORS.CANNOT_DELETE_ALL}
            </p>
          )}

          <button
            onClick={handleProcess}
            disabled={noneSelected || allSelected || status === 'processing'}
            className="w-full py-3 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus-ring"
          >
            {status === 'processing'
              ? 'Processing...'
              : noneSelected
                ? 'Select pages to delete'
                : `Delete ${selectedPages.size} Page${selectedPages.size !== 1 ? 's' : ''}`}
          </button>
        </>
      )}
    </div>
  );
}
