import { useState, useCallback, useRef, useEffect } from 'react';
import { useEditorStore } from '@/stores/editorStore';
import type { ExtractedTextItem } from '@/stores/editorStore';
import { pdfRectToScreen } from '@/lib/pdf-editor-utils';

interface TextHighlightOverlayProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  viewport: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  pdfPage: any;
  coverColor: string;
}

export function TextHighlightOverlay({ viewport, pdfPage, coverColor }: TextHighlightOverlayProps) {
  const currentPage = useEditorStore((s) => s.currentPage);
  const extractedText = useEditorStore((s) => s.extractedText);
  const setExtractedText = useEditorStore((s) => s.setExtractedText);
  const textEdits = useEditorStore((s) => s.textEdits);
  const addTextEdit = useEditorStore((s) => s.addTextEdit);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editText, setEditText] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const items = extractedText[currentPage] ?? [];

  // Lazy per-page extraction
  useEffect(() => {
    if (extractedText[currentPage] || !pdfPage) return;

    const extractText = async () => {
      try {
        const content = await pdfPage.getTextContent();
        const extracted: ExtractedTextItem[] = content.items
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .filter((item: any) => item.str && item.str.length > 0)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .map((item: any) => ({
            str: item.str,
            x: item.transform[4], // Raw PDF X
            y: item.transform[5], // Raw PDF Y — do NOT flip
            width: item.width,    // Already in PDF points
            height: item.height,
            fontName: item.fontName ?? 'Helvetica',
            fontSize: Math.abs(item.transform[3]) || 12,
          }));
        setExtractedText(currentPage, extracted);
      } catch {
        // Extraction failed — silent
      }
    };

    extractText();
  }, [currentPage, pdfPage, extractedText, setExtractedText]);

  const handleItemClick = useCallback((index: number) => {
    const item = items[index];
    // Check if already edited
    const existingEdit = textEdits.find(
      (te) => te.pageIndex === currentPage && te.x === item.x && te.y === item.y
    );
    if (existingEdit) return; // Already has an edit

    setEditingIndex(index);
    setEditText(item.str);
    setTimeout(() => inputRef.current?.focus(), 0);
  }, [items, textEdits, currentPage]);

  const handleConfirmEdit = useCallback(() => {
    if (editingIndex === null) return;
    const item = items[editingIndex];

    if (editText !== item.str) {
      addTextEdit({
        id: crypto.randomUUID(),
        pageIndex: currentPage,
        x: item.x,
        y: item.y,
        width: item.width,
        height: item.height,
        originalText: item.str,
        newText: editText,
        originalFontName: item.fontName,
        fontSize: item.fontSize,
        coverColor,
      });
    }

    setEditingIndex(null);
    setEditText('');
  }, [editingIndex, editText, items, currentPage, coverColor, addTextEdit]);

  const handleCancelEdit = useCallback(() => {
    setEditingIndex(null);
    setEditText('');
  }, []);

  return (
    <>
      {items.map((item, index) => {
        const isEdited = textEdits.some(
          (te) => te.pageIndex === currentPage && te.x === item.x && te.y === item.y
        );
        const isEditing = editingIndex === index;

        const screenRect = pdfRectToScreen(
          { x: item.x, y: item.y, width: item.width, height: item.height },
          viewport
        );

        if (screenRect.width < 2 || screenRect.height < 2) return null;

        return (
          <div
            key={`${index}-${item.x}-${item.y}`}
            className={`absolute cursor-pointer transition-colors ${
              isEdited
                ? 'bg-green-200/30 dark:bg-green-800/20 border border-green-400/50'
                : isEditing
                ? 'bg-yellow-200/50 dark:bg-yellow-800/30 border border-yellow-400'
                : 'hover:bg-blue-200/30 dark:hover:bg-blue-800/20'
            }`}
            style={{
              left: screenRect.left,
              top: screenRect.top,
              width: screenRect.width,
              height: screenRect.height,
            }}
            onClick={(e) => {
              e.stopPropagation();
              handleItemClick(index);
            }}
          >
            {isEditing && (
              <div
                className="absolute left-0 top-full mt-1 z-50 bg-white dark:bg-gray-800 shadow-lg rounded-lg border border-gray-200 dark:border-gray-700 p-2"
                onClick={(e) => e.stopPropagation()}
              >
                <input
                  ref={inputRef}
                  type="text"
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  onKeyDown={(e) => {
                    e.stopPropagation();
                    if (e.key === 'Enter') handleConfirmEdit();
                    if (e.key === 'Escape') handleCancelEdit();
                  }}
                  className="px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100 rounded w-60"
                />
                <div className="flex items-center gap-1 mt-1">
                  <button
                    onClick={handleConfirmEdit}
                    className="px-2 py-0.5 text-xs bg-indigo-600 text-white rounded hover:bg-indigo-700"
                  >
                    Apply
                  </button>
                  <button
                    onClick={handleCancelEdit}
                    className="px-2 py-0.5 text-xs text-gray-500 dark:text-gray-400 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}
