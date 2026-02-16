import { useState, useEffect, useRef, useCallback } from 'react';
import type { ToolOutput, OutputFile } from '@/types';
import { renderPageThumbnail } from '@/lib/thumbnail-renderer';
import { formatFileSize } from '@/lib/download-utils';
import { formatDuration } from '@/lib/time-estimator';
import { Eye, EyeOff, FileText } from 'lucide-react';

interface PreviewPanelProps {
  result: ToolOutput;
  originalBytes?: Uint8Array;
  showOriginalToggle?: boolean;
}

/** Renders all pages of a single PDF file with lazy loading */
function PageRenderer({ pdfBytes, pageCount }: { pdfBytes: Uint8Array; pageCount: number }) {
  const [pages, setPages] = useState<Map<number, string>>(new Map());
  const [loading, setLoading] = useState<Set<number>>(new Set());
  const containerRef = useRef<HTMLDivElement>(null);

  const loadPage = useCallback((pageIndex: number) => {
    if (pages.has(pageIndex) || loading.has(pageIndex)) return;
    setLoading((prev) => new Set(prev).add(pageIndex));
    renderPageThumbnail(pdfBytes, pageIndex, 1.0).then((url) => {
      if (url) {
        setPages((prev) => new Map(prev).set(pageIndex, url));
      }
      setLoading((prev) => {
        const next = new Set(prev);
        next.delete(pageIndex);
        return next;
      });
    });
  }, [pdfBytes, pages, loading]);

  useEffect(() => {
    setPages(new Map());
    setLoading(new Set());
  }, [pdfBytes]);

  useEffect(() => {
    if (!containerRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const idx = Number(entry.target.getAttribute('data-page-idx'));
            if (!isNaN(idx)) loadPage(idx);
          }
        }
      },
      { rootMargin: '300px', root: null }
    );

    const elements = containerRef.current.querySelectorAll('[data-page-idx]');
    elements.forEach((el) => observer.observe(el));

    return () => observer.disconnect();
  }, [pageCount, pdfBytes, loadPage]);

  return (
    <div
      ref={containerRef}
      className="space-y-3 max-h-[600px] overflow-y-auto pr-1"
      data-testid="page-renderer"
    >
      {Array.from({ length: pageCount }, (_, i) => {
        const url = pages.get(i);
        return (
          <div key={i} data-page-idx={i} className="relative">
            {url ? (
              <img
                src={url}
                alt={`Page ${i + 1}`}
                className="w-full h-auto rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm"
              />
            ) : (
              <div className="w-full aspect-[3/4] rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-700 animate-pulse flex items-center justify-center">
                <span className="text-sm text-gray-400 dark:text-gray-500">Page {i + 1}</span>
              </div>
            )}
            <span className="absolute bottom-2 right-2 bg-black/50 text-white text-[10px] px-2 py-0.5 rounded-full backdrop-blur-sm">
              {i + 1} / {pageCount}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function PreviewPanel({ result, originalBytes, showOriginalToggle }: PreviewPanelProps) {
  const [showOriginal, setShowOriginal] = useState(false);
  const [selectedFileIndex, setSelectedFileIndex] = useState(0);

  const hasMultipleFiles = result.files.length > 1;
  const selectedFile: OutputFile | undefined = result.files[selectedFileIndex];
  const displayBytes = showOriginal && originalBytes ? originalBytes : selectedFile?.bytes;
  const displayPageCount = showOriginal && originalBytes
    ? (result.files[0]?.pageCount ?? 0) // approximate — original page count
    : (selectedFile?.pageCount ?? 0);

  const totalSize = result.files.reduce((s, f) => s + f.bytes.length, 0);
  const originalSize = originalBytes?.length ?? 0;
  const sizeDiff = originalSize > 0 ? ((totalSize - originalSize) / originalSize) * 100 : 0;

  // Reset selected file when result changes
  useEffect(() => {
    setSelectedFileIndex(0);
    setShowOriginal(false);
  }, [result]);

  return (
    <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4 space-y-4">
      {/* Summary bar */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          {!hasMultipleFiles && selectedFile && (
            <>
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{selectedFile.name}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {selectedFile.pageCount} page{selectedFile.pageCount !== 1 ? 's' : ''} · {formatFileSize(selectedFile.bytes.length)}
              </p>
            </>
          )}
          {hasMultipleFiles && (
            <>
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{result.files.length} files</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Total: {formatFileSize(totalSize)}</p>
            </>
          )}
          {originalSize > 0 && (
            <p className={`text-xs ${sizeDiff < 0 ? 'text-green-600 dark:text-green-400' : 'text-gray-500 dark:text-gray-400'}`}>
              {sizeDiff < 0 ? `↓ ${Math.abs(sizeDiff).toFixed(0)}% smaller` : sizeDiff > 5 ? `↑ ${sizeDiff.toFixed(0)}% larger` : 'Similar size'}
            </p>
          )}
          <p className="text-xs text-gray-400 dark:text-gray-500">Completed in {formatDuration(result.processingTime)}</p>
        </div>

        {showOriginalToggle && originalBytes && (
          <button
            onClick={() => setShowOriginal(!showOriginal)}
            className="flex items-center gap-1.5 text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 shrink-0"
          >
            {showOriginal ? <EyeOff size={12} /> : <Eye size={12} />}
            {showOriginal ? 'Show processed' : 'Show original'}
          </button>
        )}
      </div>

      {/* File tabs for multiple files */}
      {hasMultipleFiles && !showOriginal && (
        <div className="flex gap-1 overflow-x-auto pb-1 border-b border-gray-200 dark:border-gray-700">
          {result.files.map((f, i) => (
            <button
              key={i}
              onClick={() => setSelectedFileIndex(i)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-t-lg border border-b-0 whitespace-nowrap transition-colors ${
                selectedFileIndex === i
                  ? 'bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-indigo-700 dark:text-indigo-300 font-medium'
                  : 'bg-transparent border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              <FileText size={12} />
              {f.name}
              <span className="text-gray-400 dark:text-gray-500 ml-1">{f.pageCount}p</span>
            </button>
          ))}
        </div>
      )}

      {/* Full document page renderer */}
      {displayBytes && displayPageCount > 0 && (
        <PageRenderer pdfBytes={displayBytes} pageCount={displayPageCount} />
      )}
    </div>
  );
}
