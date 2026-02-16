import { useState, useCallback, useMemo } from 'react';
import type { UploadedFile, ToolOutput } from '@/types';
import { workerClient } from '@/lib/pdf-worker-client';
import { useProcessingStore } from '@/stores/processingStore';
import { FileDropZone } from '@/components/common/FileDropZone';
import { ThumbnailGrid } from '@/components/common/ThumbnailGrid';
import { ProgressBar } from '@/components/common/ProgressBar';
import { PreviewPanel } from '@/components/common/PreviewPanel';
import { DownloadPanel } from '@/components/common/DownloadPanel';
import { ToolSuggestions } from '@/components/common/ToolSuggestions';
import { RotateCw, RotateCcw, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';

export function RotateTool() {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [rotations, setRotations] = useState<Record<number, number>>({});
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

  const hasRotations = useMemo(
    () => Object.values(rotations).some((r) => r !== 0),
    [rotations],
  );

  const handleFilesLoaded = useCallback((loaded: UploadedFile[]) => {
    setFiles(loaded);
    setRotations({});
    setResult(null);
    useProcessingStore.getState().reset();
  }, []);

  const handlePageClick = useCallback((pageIndex: number) => {
    setRotations((prev) => {
      const current = prev[pageIndex] ?? 0;
      const next = (current + 90) % 360;
      if (next === 0) {
        const updated = { ...prev };
        delete updated[pageIndex];
        return updated;
      }
      return { ...prev, [pageIndex]: next };
    });
  }, []);

  const rotateAll = useCallback((degrees: number) => {
    if (!file) return;
    setRotations((prev) => {
      const updated: Record<number, number> = {};
      for (let i = 0; i < file.pageCount; i++) {
        const current = prev[i] ?? 0;
        const next = ((current + degrees) % 360 + 360) % 360;
        if (next !== 0) {
          updated[i] = next;
        }
      }
      return updated;
    });
  }, [file]);

  const rotateSubset = useCallback((filter: 'even' | 'odd', degrees: number) => {
    if (!file) return;
    setRotations((prev) => {
      const updated = { ...prev };
      for (let i = 0; i < file.pageCount; i++) {
        const pageNum = i + 1; // 1-indexed for even/odd logic
        const matches = filter === 'even' ? pageNum % 2 === 0 : pageNum % 2 === 1;
        if (matches) {
          const current = updated[i] ?? 0;
          const next = ((current + degrees) % 360 + 360) % 360;
          if (next === 0) {
            delete updated[i];
          } else {
            updated[i] = next;
          }
        }
      }
      return updated;
    });
  }, [file]);

  const clearRotations = useCallback(() => {
    setRotations({});
  }, []);

  const handleProcess = useCallback(async () => {
    if (!file || !hasRotations) return;

    try {
      const output = await workerClient.process('rotate', [file.bytes], {
        rotations,
      });
      setResult(output);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      toast.error(message);
    }
  }, [file, hasRotations, rotations]);

  const handleReset = useCallback(() => {
    setFiles([]);
    setRotations({});
    setResult(null);
    useProcessingStore.getState().reset();
  }, []);

  // Result state
  if (result) {
    return (
      <div className="space-y-4">
        <PreviewPanel
          result={result}
          originalBytes={file?.bytes}
          showOriginalToggle
        />
        <DownloadPanel result={result} onReset={handleReset} />
      </div>
    );
  }

  // No file loaded
  if (!file) {
    return <FileDropZone onFilesLoaded={handleFilesLoaded} />;
  }

  // Configure and process
  return (
    <div className="space-y-6">
      <FileDropZone onFilesLoaded={handleFilesLoaded} />

      <ToolSuggestions analysis={analysis} currentToolId="rotate" />

      {/* Bulk rotation actions */}
      <div className="space-y-2">
        <h3 className="text-sm font-medium text-gray-700">Bulk actions</h3>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => rotateAll(90)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <RotateCw size={14} /> Rotate All 90° CW
          </button>
          <button
            onClick={() => rotateAll(-90)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <RotateCcw size={14} /> Rotate All 90° CCW
          </button>
          <button
            onClick={() => rotateAll(180)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <RotateCw size={14} /> Rotate All 180°
          </button>
          <button
            onClick={() => rotateSubset('even', 90)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <RotateCw size={14} /> Rotate Even 90° CW
          </button>
          <button
            onClick={() => rotateSubset('odd', 90)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <RotateCw size={14} /> Rotate Odd 90° CW
          </button>
          {hasRotations && (
            <button
              onClick={clearRotations}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-red-200 text-red-600 rounded-lg hover:bg-red-50 transition-colors"
            >
              <RefreshCw size={14} /> Reset all
            </button>
          )}
        </div>
        <p className="text-xs text-gray-400">
          Click individual thumbnails to cycle rotation (90° increments).
          {hasRotations && (
            <span className="ml-1 text-amber-600">
              {Object.keys(rotations).length} page{Object.keys(rotations).length !== 1 ? 's' : ''} rotated
            </span>
          )}
        </p>
      </div>

      {/* Thumbnail grid */}
      <ThumbnailGrid
        pdfBytes={file.bytes}
        pageCount={file.pageCount}
        onPageClick={handlePageClick}
        overlayType="rotate"
        rotations={rotations}
      />

      <ProgressBar />

      {/* Process button */}
      <button
        onClick={handleProcess}
        disabled={!hasRotations || status === 'processing'}
        className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus-ring"
      >
        <RotateCw size={16} />
        {status === 'processing' ? 'Processing...' : 'Rotate Pages'}
      </button>
    </div>
  );
}
