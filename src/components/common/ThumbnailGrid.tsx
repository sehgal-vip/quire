import { useState, useEffect, useRef, useCallback } from 'react';
import { CheckCircle, Trash2, RotateCw, AlertTriangle } from 'lucide-react';
import { renderPageThumbnail } from '@/lib/thumbnail-renderer';
import { renderQueue } from '@/lib/render-queue';
import type { ThumbnailState } from '@/types';

interface ThumbnailGridProps {
  pdfBytes: Uint8Array;
  pageCount: number;
  selectedPages?: Set<number>;
  onPageClick?: (pageIndex: number) => void;
  overlayType?: 'selected' | 'delete' | 'rotate';
  rotations?: Record<number, number>;
}

export function ThumbnailGrid({ pdfBytes, pageCount, selectedPages, onPageClick, overlayType = 'selected', rotations }: ThumbnailGridProps) {
  const [thumbnails, setThumbnails] = useState<Map<number, string>>(new Map());
  const [states, setStates] = useState<Map<number, ThumbnailState>>(new Map());
  const [focusedIndex, setFocusedIndex] = useState(0);
  const gridRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  const loadThumbnail = useCallback((pageIndex: number) => {
    setStates((prev) => new Map(prev).set(pageIndex, 'loading'));
    renderQueue.enqueue(pageIndex, 'high', () => renderPageThumbnail(pdfBytes, pageIndex))
      .then((url) => {
        if (url) {
          setThumbnails((prev) => new Map(prev).set(pageIndex, url));
          setStates((prev) => new Map(prev).set(pageIndex, 'rendered'));
        } else {
          setStates((prev) => new Map(prev).set(pageIndex, 'failed'));
        }
      });
  }, [pdfBytes]);

  useEffect(() => {
    renderQueue.cancelAll();
    setThumbnails(new Map());
    setStates(new Map());
  }, [pdfBytes]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const idx = Number(entry.target.getAttribute('data-page'));
          if (isNaN(idx)) continue;
          if (entry.isIntersecting && !thumbnails.has(idx) && states.get(idx) !== 'loading') {
            loadThumbnail(idx);
          }
        }
      },
      { rootMargin: '200px' }
    );
    observerRef.current = observer;

    const cells = gridRef.current?.querySelectorAll('[data-page]');
    cells?.forEach((cell) => observer.observe(cell));

    return () => observer.disconnect();
  }, [pageCount, loadThumbnail, thumbnails, states]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    const cols = Math.floor((gridRef.current?.clientWidth ?? 600) / 170);
    let next = focusedIndex;
    if (e.key === 'ArrowRight') next = Math.min(focusedIndex + 1, pageCount - 1);
    else if (e.key === 'ArrowLeft') next = Math.max(focusedIndex - 1, 0);
    else if (e.key === 'ArrowDown') next = Math.min(focusedIndex + cols, pageCount - 1);
    else if (e.key === 'ArrowUp') next = Math.max(focusedIndex - cols, 0);
    else if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); onPageClick?.(focusedIndex); return; }
    else return;
    e.preventDefault();
    setFocusedIndex(next);
  };

  return (
    <div
      ref={gridRef}
      className="grid gap-3"
      style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))' }}
      role="grid"
      onKeyDown={handleKeyDown}
      tabIndex={0}
    >
      {Array.from({ length: pageCount }, (_, i) => {
        const state = states.get(i);
        const thumb = thumbnails.get(i);
        const isSelected = selectedPages?.has(i);
        const rotation = rotations?.[i] ?? 0;
        const isFocused = focusedIndex === i;

        return (
          <div
            key={i}
            data-page={i}
            role="gridcell"
            className={`relative aspect-[3/4] rounded-lg overflow-hidden cursor-pointer border-2 transition-all ${
              isSelected && overlayType === 'selected' ? 'border-indigo-500 ring-2 ring-indigo-200' :
              isSelected && overlayType === 'delete' ? 'border-red-500 ring-2 ring-red-200' :
              'border-transparent hover:border-gray-300'
            } ${isFocused ? 'ring-2 ring-indigo-400 ring-offset-2' : ''}`}
            onClick={() => onPageClick?.(i)}
            tabIndex={-1}
          >
            {/* Thumbnail or placeholder */}
            {state === 'rendered' && thumb ? (
              <img src={thumb} alt={`Page ${i + 1}`} className="w-full h-full object-cover bg-white" />
            ) : state === 'failed' ? (
              <div className="w-full h-full bg-gray-100 flex flex-col items-center justify-center">
                <AlertTriangle size={20} className="text-amber-400 mb-1" />
                <span className="text-xs text-gray-400">Page {i + 1}</span>
              </div>
            ) : (
              <div className="w-full h-full bg-gray-100 animate-pulse flex items-center justify-center">
                <span className="text-xs text-gray-400">{i + 1}</span>
              </div>
            )}

            {/* Page number */}
            <span className="absolute bottom-1 left-1/2 -translate-x-1/2 text-[10px] bg-black/60 text-white px-1.5 py-0.5 rounded">
              {i + 1}
            </span>

            {/* Selection overlay */}
            {isSelected && overlayType === 'selected' && (
              <div className="absolute inset-0 bg-indigo-500/10 flex items-center justify-center">
                <CheckCircle size={24} className="text-indigo-600" />
              </div>
            )}
            {isSelected && overlayType === 'delete' && (
              <div className="absolute inset-0 bg-red-500/20 flex items-center justify-center">
                <Trash2 size={24} className="text-red-600" />
              </div>
            )}

            {/* Rotation indicator */}
            {rotation > 0 && (
              <span className="absolute top-1 right-1 bg-amber-500 text-white text-[10px] px-1 rounded flex items-center gap-0.5">
                <RotateCw size={10} /> {rotation}°
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
