import { useState, useCallback, useEffect, useRef } from 'react';
import { parsePageRange, pagesToRangeString } from '@/lib/page-range-parser';
import { BatchSelectionBar } from './BatchSelectionBar';
import { ThumbnailGrid } from './ThumbnailGrid';

interface PageSelectorProps {
  pageCount: number;
  pdfBytes: Uint8Array;
  selectedPages: Set<number>;
  onSelectionChange: (pages: Set<number>) => void;
  overlayType?: 'selected' | 'delete';
}

export function PageSelector({ pageCount, pdfBytes, selectedPages, onSelectionChange, overlayType = 'selected' }: PageSelectorProps) {
  const [rangeText, setRangeText] = useState('');
  const [rangeError, setRangeError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const isInternalUpdate = useRef(false);

  // Sync from selection to text
  useEffect(() => {
    if (isInternalUpdate.current) {
      isInternalUpdate.current = false;
      return;
    }
    setRangeText(pagesToRangeString(Array.from(selectedPages).map((i) => i + 1)));
  }, [selectedPages]);

  // Parse text input
  const handleRangeChange = useCallback((text: string) => {
    setRangeText(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if (!text.trim()) {
        onSelectionChange(new Set());
        setRangeError(null);
        return;
      }
      const result = parsePageRange(text, pageCount);
      if (result.error) {
        setRangeError(result.error);
      } else {
        setRangeError(null);
        isInternalUpdate.current = true;
        onSelectionChange(new Set(result.pages.map((p) => p - 1)));
      }
    }, 300);
  }, [pageCount, onSelectionChange]);

  const handlePageClick = (idx: number) => {
    isInternalUpdate.current = true;
    const next = new Set(selectedPages);
    if (next.has(idx)) next.delete(idx); else next.add(idx);
    onSelectionChange(next);
  };

  const selectAll = () => { isInternalUpdate.current = true; onSelectionChange(new Set(Array.from({ length: pageCount }, (_, i) => i))); };
  const selectEven = () => { isInternalUpdate.current = true; onSelectionChange(new Set(Array.from({ length: pageCount }, (_, i) => i).filter((i) => (i + 1) % 2 === 0))); };
  const selectOdd = () => { isInternalUpdate.current = true; onSelectionChange(new Set(Array.from({ length: pageCount }, (_, i) => i).filter((i) => (i + 1) % 2 === 1))); };
  const invert = () => { isInternalUpdate.current = true; onSelectionChange(new Set(Array.from({ length: pageCount }, (_, i) => i).filter((i) => !selectedPages.has(i)))); };
  const clear = () => { isInternalUpdate.current = true; onSelectionChange(new Set()); };

  return (
    <div className="space-y-4">
      <div>
        <label htmlFor="page-range" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Page range</label>
        <input
          id="page-range"
          type="text"
          value={rangeText}
          onChange={(e) => handleRangeChange(e.target.value)}
          placeholder="e.g., 1-3, 5, 8-end"
          className={`w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none dark:bg-gray-800 dark:text-gray-100 ${rangeError ? 'border-red-300 dark:border-red-700' : 'border-gray-300 dark:border-gray-600'}`}
        />
        {rangeError && <p className="text-xs text-red-500 dark:text-red-400 mt-1">{rangeError}</p>}
      </div>
      <BatchSelectionBar pageCount={pageCount} selectedCount={selectedPages.size} onSelectAll={selectAll} onSelectEven={selectEven} onSelectOdd={selectOdd} onInvert={invert} onClear={clear} />
      <ThumbnailGrid pdfBytes={pdfBytes} pageCount={pageCount} selectedPages={selectedPages} onPageClick={handlePageClick} overlayType={overlayType} />
    </div>
  );
}
