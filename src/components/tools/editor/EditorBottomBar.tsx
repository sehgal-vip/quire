import { useEditorStore } from '@/stores/editorStore';

interface EditorBottomBarProps {
  totalPages: number;
}

export function EditorBottomBar({ totalPages }: EditorBottomBarProps) {
  const currentPage = useEditorStore((s) => s.currentPage);
  const setCurrentPage = useEditorStore((s) => s.setCurrentPage);

  return (
    <div className="flex-none bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 px-4 py-1.5 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <button
          onClick={() => setCurrentPage(Math.max(0, currentPage - 1))}
          disabled={currentPage === 0}
          className="px-2 py-0.5 text-xs rounded border border-gray-300 dark:border-gray-600 disabled:opacity-30 hover:bg-gray-50 dark:hover:bg-gray-800"
        >
          Prev
        </button>
        <span className="text-xs text-gray-600 dark:text-gray-400">
          Page {currentPage + 1} of {totalPages}
        </span>
        <button
          onClick={() => setCurrentPage(Math.min(totalPages - 1, currentPage + 1))}
          disabled={currentPage >= totalPages - 1}
          className="px-2 py-0.5 text-xs rounded border border-gray-300 dark:border-gray-600 disabled:opacity-30 hover:bg-gray-50 dark:hover:bg-gray-800"
        >
          Next
        </button>
      </div>
      <div className="text-[10px] text-gray-400 dark:text-gray-500">
        Ctrl+Z Undo | Ctrl+Shift+Z Redo | Del Delete selection | Esc Deselect
      </div>
    </div>
  );
}
