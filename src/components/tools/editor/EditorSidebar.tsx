import { useEffect, useRef, useCallback } from 'react';
import { useEditorStore } from '@/stores/editorStore';

interface EditorSidebarProps {
  pdfDoc: { numPages: number; getPage: (num: number) => Promise<unknown> } | null;
  collapsed: boolean;
  onToggle: () => void;
}

export function EditorSidebar({ pdfDoc, collapsed, onToggle }: EditorSidebarProps) {
  const currentPage = useEditorStore((s) => s.currentPage);
  const setCurrentPage = useEditorStore((s) => s.setCurrentPage);
  const canvasRefs = useRef<Map<number, HTMLCanvasElement>>(new Map());

  const renderThumbnail = useCallback(async (pageNum: number, canvas: HTMLCanvasElement) => {
    if (!pdfDoc) return;
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const page = await (pdfDoc as any).getPage(pageNum);
      const viewport = page.getViewport({ scale: 0.2 });
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      await page.render({ canvasContext: ctx, viewport }).promise;
    } catch {
      // Silent fail for thumbnails
    }
  }, [pdfDoc]);

  useEffect(() => {
    if (!pdfDoc || collapsed) return;
    canvasRefs.current.forEach((canvas, pageNum) => {
      renderThumbnail(pageNum, canvas);
    });
  }, [pdfDoc, collapsed, renderThumbnail]);

  if (collapsed) {
    return (
      <button
        onClick={onToggle}
        className="flex-none w-8 bg-gray-50 dark:bg-gray-850 border-r border-gray-200 dark:border-gray-700 flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-800"
        aria-label="Expand sidebar"
      >
        <span className="text-xs text-gray-400 [writing-mode:vertical-lr]">Pages</span>
      </button>
    );
  }

  return (
    <div className="flex-none w-32 bg-gray-50 dark:bg-gray-850 border-r border-gray-200 dark:border-gray-700 overflow-y-auto">
      <div className="flex items-center justify-between px-2 py-1.5 border-b border-gray-200 dark:border-gray-700">
        <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">Pages</span>
        <button
          onClick={onToggle}
          className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
        >
          Hide
        </button>
      </div>
      <div className="p-2 space-y-2">
        {pdfDoc && Array.from({ length: pdfDoc.numPages }, (_, i) => i + 1).map((pageNum) => (
          <button
            key={pageNum}
            onClick={() => setCurrentPage(pageNum - 1)}
            className={`w-full rounded-lg border-2 overflow-hidden transition-colors ${
              currentPage === pageNum - 1
                ? 'border-indigo-500'
                : 'border-transparent hover:border-gray-300 dark:hover:border-gray-600'
            }`}
          >
            <canvas
              ref={(el) => {
                if (el) {
                  canvasRefs.current.set(pageNum, el);
                }
              }}
              className="w-full"
            />
            <div className="text-[10px] text-gray-500 dark:text-gray-400 text-center py-0.5">
              {pageNum}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
