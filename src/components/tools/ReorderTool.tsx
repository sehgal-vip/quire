import { useState, useCallback, useEffect, useRef } from 'react';
import { ArrowLeft, ArrowRight, RotateCcw, AlertTriangle, GripVertical } from 'lucide-react';
import { FileDropZone } from '@/components/common/FileDropZone';
import { ProgressBar } from '@/components/common/ProgressBar';
import { PreviewPanel } from '@/components/common/PreviewPanel';
import { DownloadPanel } from '@/components/common/DownloadPanel';
import { ToolSuggestions } from '@/components/common/ToolSuggestions';
import { workerClient } from '@/lib/pdf-worker-client';
import { renderPageThumbnail } from '@/lib/thumbnail-renderer';
import { renderQueue } from '@/lib/render-queue';
import { useProcessingStore } from '@/stores/processingStore';
import toast from 'react-hot-toast';
import type { UploadedFile, ToolOutput, ThumbnailState } from '@/types';

export function ReorderTool() {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [pageOrder, setPageOrder] = useState<number[]>([]);
  const [result, setResult] = useState<ToolOutput | null>(null);
  const [thumbnails, setThumbnails] = useState<Map<number, string>>(new Map());
  const [thumbStates, setThumbStates] = useState<Map<number, ThumbnailState>>(new Map());
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [insertAt, setInsertAt] = useState<number | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);

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
    setThumbnails(new Map());
    setThumbStates(new Map());
    renderQueue.cancelAll();
    if (loaded.length > 0) {
      setPageOrder(Array.from({ length: loaded[0].pageCount }, (_, i) => i));
    } else {
      setPageOrder([]);
    }
  }, []);

  // Load thumbnails via IntersectionObserver
  const loadThumbnail = useCallback((pageIndex: number) => {
    if (!file) return;
    setThumbStates((prev) => new Map(prev).set(pageIndex, 'loading'));
    renderQueue.enqueue(pageIndex, 'high', () => renderPageThumbnail(file.bytes, pageIndex))
      .then((url) => {
        if (url) {
          setThumbnails((prev) => new Map(prev).set(pageIndex, url));
          setThumbStates((prev) => new Map(prev).set(pageIndex, 'rendered'));
        } else {
          setThumbStates((prev) => new Map(prev).set(pageIndex, 'failed'));
        }
      });
  }, [file]);

  useEffect(() => {
    if (!file || pageOrder.length === 0) return;
    renderQueue.cancelAll();
    setThumbnails(new Map());
    setThumbStates(new Map());
  }, [file]);

  useEffect(() => {
    if (!file || pageOrder.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const idx = Number(entry.target.getAttribute('data-page'));
          if (isNaN(idx)) continue;
          if (entry.isIntersecting && !thumbnails.has(idx) && thumbStates.get(idx) !== 'loading') {
            loadThumbnail(idx);
          }
        }
      },
      { rootMargin: '200px' }
    );

    const cells = gridRef.current?.querySelectorAll('[data-page]');
    cells?.forEach((cell) => observer.observe(cell));

    return () => observer.disconnect();
  }, [pageOrder, file, loadThumbnail, thumbnails, thumbStates]);

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

  // Drag-and-drop handlers
  const handleDragStart = (e: React.DragEvent, position: number) => {
    setDragIndex(position);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(position));
    // Make the drag image slightly transparent
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = '0.5';
    }
  };

  const handleDragEnd = (e: React.DragEvent) => {
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = '1';
    }
    setDragIndex(null);
    setInsertAt(null);
  };

  const handleDragOver = (e: React.DragEvent, position: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    // Determine if mouse is on left or right half of the card
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const midX = rect.left + rect.width / 2;
    const insertPos = e.clientX < midX ? position : position + 1;
    setInsertAt(insertPos);
  };

  const handleDragLeave = () => {
    // Don't clear insertAt here — we only clear on dragEnd/drop
  };

  const handleGridDragLeave = (e: React.DragEvent) => {
    // Only clear if leaving the grid entirely
    if (gridRef.current && !gridRef.current.contains(e.relatedTarget as Node)) {
      setInsertAt(null);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const fromPosition = dragIndex;
    if (fromPosition === null || insertAt === null) {
      setDragIndex(null);
      setInsertAt(null);
      return;
    }

    // Calculate actual insertion index accounting for the removed item
    let targetIndex = insertAt;
    if (fromPosition < targetIndex) {
      targetIndex -= 1; // Adjust because removing the item shifts indices down
    }
    if (fromPosition === targetIndex) {
      setDragIndex(null);
      setInsertAt(null);
      return;
    }

    setPageOrder((prev) => {
      const next = [...prev];
      const [moved] = next.splice(fromPosition, 1);
      next.splice(targetIndex, 0, moved);
      return next;
    });

    setDragIndex(null);
    setInsertAt(null);
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
    setThumbnails(new Map());
    setThumbStates(new Map());
    renderQueue.cancelAll();
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
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {file.pageCount} page{file.pageCount !== 1 ? 's' : ''} — drag or use arrows to reorder
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={resetOrder}
                disabled={!hasChanged}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <RotateCcw size={14} />
                Reset Order
              </button>
              <button
                onClick={handleProcess}
                disabled={!hasChanged || status === 'processing'}
                className="flex items-center gap-1.5 px-4 py-1.5 text-sm font-medium bg-indigo-600 dark:bg-indigo-500 text-white rounded-lg hover:bg-indigo-700 dark:hover:bg-indigo-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {status === 'processing' ? 'Processing...' : 'Reorder Pages'}
              </button>
            </div>
          </div>

          <div
            ref={gridRef}
            className="grid gap-3"
            style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))' }}
            onDragLeave={handleGridDragLeave}
          >
            {pageOrder.map((pageIdx, position) => {
              const thumb = thumbnails.get(pageIdx);
              const state = thumbStates.get(pageIdx);
              const isMoved = pageIdx !== position;
              const isDragging = dragIndex === position;
              const showLineBefore = insertAt === position && dragIndex !== null && dragIndex !== position && dragIndex !== position - 1;
              const showLineAfter = position === pageOrder.length - 1 && insertAt === pageOrder.length && dragIndex !== null && dragIndex !== position;

              return (
                <div
                  key={`${position}-${pageIdx}`}
                  data-page={pageIdx}
                  draggable
                  onDragStart={(e) => handleDragStart(e, position)}
                  onDragEnd={handleDragEnd}
                  onDragOver={(e) => handleDragOver(e, position)}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  className={`relative aspect-[3/4] rounded-lg border-2 transition-all cursor-grab active:cursor-grabbing ${
                    isDragging
                      ? 'border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-800 opacity-50'
                      : isMoved
                        ? 'border-indigo-300 dark:border-indigo-700 bg-indigo-50 dark:bg-indigo-950'
                        : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800'
                  }`}
                >
                  {/* Insertion line — left side */}
                  {showLineBefore && (
                    <div
                      className="absolute -left-[7px] top-0 bottom-0 w-[3px] bg-indigo-500 rounded-full z-20"
                      data-testid="insertion-line"
                    >
                      <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-indigo-500 rounded-full" />
                      <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-indigo-500 rounded-full" />
                    </div>
                  )}
                  {/* Insertion line — right side (only for last card) */}
                  {showLineAfter && (
                    <div
                      className="absolute -right-[7px] top-0 bottom-0 w-[3px] bg-indigo-500 rounded-full z-20"
                      data-testid="insertion-line"
                    >
                      <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-indigo-500 rounded-full" />
                      <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-indigo-500 rounded-full" />
                    </div>
                  )}
                  {/* Drag handle indicator */}
                  <div className="absolute top-1 left-1/2 -translate-x-1/2 z-10">
                    <GripVertical size={14} className="text-gray-400 dark:text-gray-500" />
                  </div>

                  {/* Thumbnail or placeholder */}
                  <div className="w-full h-full overflow-hidden rounded-md">
                    {state === 'rendered' && thumb ? (
                      <img
                        src={thumb}
                        alt={`Page ${pageIdx + 1}`}
                        className="w-full h-full object-cover bg-white pointer-events-none"
                        draggable={false}
                      />
                    ) : state === 'failed' ? (
                      <div className="w-full h-full bg-gray-100 dark:bg-gray-800 flex flex-col items-center justify-center">
                        <AlertTriangle size={20} className="text-amber-400 mb-1" />
                        <span className="text-xs text-gray-400 dark:text-gray-500">Page {pageIdx + 1}</span>
                      </div>
                    ) : (
                      <div className="w-full h-full bg-gray-100 dark:bg-gray-800 animate-pulse flex items-center justify-center">
                        <span className="text-lg font-bold text-gray-300 dark:text-gray-600">{pageIdx + 1}</span>
                      </div>
                    )}
                  </div>

                  {/* Page number badge */}
                  <span className="absolute bottom-8 left-1/2 -translate-x-1/2 text-[10px] bg-black/60 text-white px-1.5 py-0.5 rounded">
                    {pageIdx + 1}
                  </span>

                  {/* Moved indicator */}
                  {isMoved && (
                    <span className="absolute top-1 right-1 text-[9px] bg-indigo-500 text-white px-1 rounded">
                      was {pageIdx + 1}
                    </span>
                  )}

                  {/* Arrow buttons */}
                  <div className="absolute bottom-1.5 left-0 right-0 flex justify-center gap-1">
                    <button
                      onClick={(e) => { e.stopPropagation(); moveLeft(position); }}
                      disabled={position === 0}
                      className="p-1 bg-white/90 dark:bg-gray-800/90 border border-gray-200 dark:border-gray-700 rounded hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                      aria-label={`Move page ${pageIdx + 1} left`}
                    >
                      <ArrowLeft size={12} className="text-gray-600 dark:text-gray-400" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); moveRight(position); }}
                      disabled={position === pageOrder.length - 1}
                      className="p-1 bg-white/90 dark:bg-gray-800/90 border border-gray-200 dark:border-gray-700 rounded hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                      aria-label={`Move page ${pageIdx + 1} right`}
                    >
                      <ArrowRight size={12} className="text-gray-600 dark:text-gray-400" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <button
            onClick={handleProcess}
            disabled={!hasChanged || status === 'processing'}
            className="w-full py-3 bg-indigo-600 dark:bg-indigo-500 text-white font-medium rounded-lg hover:bg-indigo-700 dark:hover:bg-indigo-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus-ring"
          >
            {status === 'processing' ? 'Processing...' : 'Reorder Pages'}
          </button>
        </>
      )}
    </div>
  );
}
