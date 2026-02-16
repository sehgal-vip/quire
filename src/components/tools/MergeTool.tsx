import { useState, useCallback, useMemo } from 'react';
import type { UploadedFile, ToolOutput } from '@/types';
import { workerClient } from '@/lib/pdf-worker-client';
import { useProcessingStore } from '@/stores/processingStore';
import { ERRORS } from '@/lib/error-messages';
import { FileDropZone } from '@/components/common/FileDropZone';
import { ProgressBar } from '@/components/common/ProgressBar';
import { PreviewPanel } from '@/components/common/PreviewPanel';
import { DownloadPanel } from '@/components/common/DownloadPanel';
import { ToolSuggestions } from '@/components/common/ToolSuggestions';
import { formatFileSize } from '@/lib/download-utils';
import { Combine, ChevronUp, ChevronDown, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';

export function MergeTool() {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [result, setResult] = useState<ToolOutput | null>(null);

  const status = useProcessingStore((s) => s.status);

  const totalPageCount = useMemo(
    () => files.reduce((sum, f) => sum + f.pageCount, 0),
    [files],
  );

  const analysis = useMemo(() => {
    if (files.length === 0) return null;
    return {
      isEncrypted: files.some((f) => f.isEncrypted),
      pageCount: totalPageCount,
      hasMixedPageSizes: false,
    };
  }, [files, totalPageCount]);

  const canProcess = files.length >= 2;

  const handleFilesLoaded = useCallback((loaded: UploadedFile[]) => {
    setFiles(loaded);
    setResult(null);
    useProcessingStore.getState().reset();
  }, []);

  const moveFile = useCallback((index: number, direction: 'up' | 'down') => {
    setFiles((prev) => {
      const next = [...prev];
      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= next.length) return prev;
      [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
      return next;
    });
  }, []);

  const removeFile = useCallback((index: number) => {
    setFiles((prev) => {
      const next = prev.filter((_, i) => i !== index);
      return next;
    });
  }, []);

  const handleProcess = useCallback(async () => {
    if (files.length < 2) {
      toast.error(ERRORS.MERGE_MIN_FILES);
      return;
    }

    try {
      const output = await workerClient.process(
        'merge',
        files.map((f) => f.bytes),
        { order: files.map((_, i) => i) },
      );
      setResult(output);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      toast.error(message);
    }
  }, [files]);

  const handleReset = useCallback(() => {
    setFiles([]);
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
      <FileDropZone onFilesLoaded={handleFilesLoaded} multiple />

      {files.length > 0 && (<>

      <ToolSuggestions analysis={analysis} currentToolId="merge" />

      {/* Top toolbar */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {files.length} file{files.length !== 1 ? 's' : ''} — {totalPageCount} total page{totalPageCount !== 1 ? 's' : ''}
        </p>
        <button
          onClick={handleProcess}
          disabled={!canProcess || status === 'processing'}
          className="flex items-center gap-1.5 px-4 py-1.5 text-sm font-medium bg-indigo-600 dark:bg-indigo-500 text-white rounded-lg hover:bg-indigo-700 dark:hover:bg-indigo-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Combine size={14} />
          {status === 'processing' ? 'Processing...' : 'Merge PDFs'}
        </button>
      </div>

      {/* File list with reordering */}
      <div className="space-y-2">
        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
          File order ({files.length} file{files.length !== 1 ? 's' : ''})
        </h3>
        <div className="space-y-1">
          {files.map((file, index) => (
            <div
              key={file.id}
              className="flex items-center gap-2 border border-gray-200 dark:border-gray-700 rounded-lg p-3 bg-white dark:bg-gray-800"
            >
              <span className="text-xs font-mono text-gray-400 dark:text-gray-500 w-6 text-center shrink-0">
                {index + 1}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{file.name}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {file.pageCount} page{file.pageCount !== 1 ? 's' : ''} · {formatFileSize(file.fileSize)}
                </p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => moveFile(index, 'up')}
                  disabled={index === 0}
                  className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  aria-label={`Move ${file.name} up`}
                >
                  <ChevronUp size={16} className="text-gray-500 dark:text-gray-400" />
                </button>
                <button
                  onClick={() => moveFile(index, 'down')}
                  disabled={index === files.length - 1}
                  className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  aria-label={`Move ${file.name} down`}
                >
                  <ChevronDown size={16} className="text-gray-500 dark:text-gray-400" />
                </button>
                <button
                  onClick={() => removeFile(index)}
                  className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-950 transition-colors"
                  aria-label={`Remove ${file.name}`}
                >
                  <Trash2 size={16} className="text-gray-400 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400" />
                </button>
              </div>
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-400 dark:text-gray-500">
          Total: {totalPageCount} page{totalPageCount !== 1 ? 's' : ''}
        </p>
      </div>

      <ProgressBar />

      {/* Process button */}
      <button
        onClick={handleProcess}
        disabled={!canProcess || status === 'processing'}
        className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 dark:bg-indigo-500 text-white font-medium rounded-lg hover:bg-indigo-700 dark:hover:bg-indigo-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus-ring"
      >
        <Combine size={16} />
        {status === 'processing' ? 'Processing...' : 'Merge PDFs'}
      </button>      </>)}
    </div>
  );
}