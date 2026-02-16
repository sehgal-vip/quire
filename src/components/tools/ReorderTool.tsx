import { useState, useCallback } from 'react';
import { ArrowLeft, ArrowRight, RotateCcw } from 'lucide-react';
import { FileDropZone } from '@/components/common/FileDropZone';
import { ProgressBar } from '@/components/common/ProgressBar';
import { PreviewPanel } from '@/components/common/PreviewPanel';
import { DownloadPanel } from '@/components/common/DownloadPanel';
import { ToolSuggestions } from '@/components/common/ToolSuggestions';
import { workerClient } from '@/lib/pdf-worker-client';
import { useProcessingStore } from '@/stores/processingStore';
import toast from 'react-hot-toast';
import type { UploadedFile, ToolOutput } from '@/types';

export function ReorderTool() {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [pageOrder, setPageOrder] = useState<number[]>([]);
  const [result, setResult] = useState<ToolOutput | null>(null);

  const status = useProcessingStore((s) => s.status);

  const file = files[0] ?? null;

  const originalOrder = file
    ? Array.from({ length: file.pageCount }, (_, i) => i)
    : [];

  const hasChanged =
    pageOrder.length > 0 &&
    pageOrder.some((page, idx) => page !== idx);

  const handleFilesLoaded = useCallback((loaded: UploadedFile[]) => {
    setFiles(loaded);
    setResult(null);
    if (loaded.length > 0) {
      setPageOrder(Array.from({ length: loaded[0].pageCount }, (_, i) => i));
    } else {
      setPageOrder([]);
    }
  }, []);

  const moveLeft = (index: number) => {
    if (index <= 0) return;
    setPageOrder((prev) => {
      const next = [...prev];
      [next[index - 1], next[index]] = [next[index], next[index - 1]];
      return next;
    });
  };

  const moveRight = (index: number) => {
    if (index >= pageOrder.length - 1) return;
    setPageOrder((prev) => {
      const next = [...prev];
      [next[index], next[index + 1]] = [next[index + 1], next[index]];
      return next;
    });
  };

  const resetOrder = () => {
    setPageOrder([...originalOrder]);
  };

  const handleProcess = async () => {
    if (!file) return;
    try {
      const output = await workerClient.process('reorder', [file.bytes], {
        newOrder: pageOrder,
      });
      setResult(output);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    }
  };

  const handleReset = () => {
    setFiles([]);
    setPageOrder([]);
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

      {file && <ToolSuggestions analysis={analysis} currentToolId="reorder" />}

      {status === 'processing' && <ProgressBar />}

      {file && pageOrder.length > 0 && (
        <>
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">
              {file.pageCount} page{file.pageCount !== 1 ? 's' : ''} — drag or use arrows to reorder
            </p>
            <button
              onClick={resetOrder}
              disabled={!hasChanged}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <RotateCcw size={14} />
              Reset Order
            </button>
          </div>

          <div
            className="grid gap-3"
            style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))' }}
          >
            {pageOrder.map((pageIdx, position) => (
              <div
                key={`${position}-${pageIdx}`}
                className={`relative aspect-[3/4] rounded-lg border-2 transition-all flex flex-col items-center justify-center ${
                  pageIdx !== position
                    ? 'border-indigo-300 bg-indigo-50'
                    : 'border-gray-200 bg-gray-50'
                }`}
              >
                <span className="text-2xl font-bold text-gray-700">{pageIdx + 1}</span>
                <span className="text-[10px] text-gray-400 mt-1">
                  {pageIdx !== position ? `was ${pageIdx + 1}` : `page ${pageIdx + 1}`}
                </span>

                <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1">
                  <button
                    onClick={() => moveLeft(position)}
                    disabled={position === 0}
                    className="p-1 bg-white/80 border border-gray-200 rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    aria-label={`Move page ${pageIdx + 1} left`}
                  >
                    <ArrowLeft size={14} className="text-gray-600" />
                  </button>
                  <button
                    onClick={() => moveRight(position)}
                    disabled={position === pageOrder.length - 1}
                    className="p-1 bg-white/80 border border-gray-200 rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    aria-label={`Move page ${pageIdx + 1} right`}
                  >
                    <ArrowRight size={14} className="text-gray-600" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          <button
            onClick={handleProcess}
            disabled={!hasChanged || status === 'processing'}
            className="w-full py-3 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus-ring"
          >
            {status === 'processing' ? 'Processing...' : 'Reorder Pages'}
          </button>
        </>
      )}
    </div>
  );
}
