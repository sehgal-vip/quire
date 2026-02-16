interface BatchSelectionBarProps {
  pageCount: number;
  selectedCount: number;
  onSelectAll: () => void;
  onSelectEven: () => void;
  onSelectOdd: () => void;
  onInvert: () => void;
  onClear: () => void;
}

export function BatchSelectionBar({ pageCount, selectedCount, onSelectAll, onSelectEven, onSelectOdd, onInvert, onClear }: BatchSelectionBarProps) {
  const btnClass = 'px-2.5 py-1 text-xs font-medium rounded-md border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors focus-ring';
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-sm text-gray-500 dark:text-gray-400 mr-2">
        {selectedCount} of {pageCount} selected
      </span>
      <button onClick={onSelectAll} className={btnClass}>All</button>
      <button onClick={onSelectEven} className={btnClass}>Even</button>
      <button onClick={onSelectOdd} className={btnClass}>Odd</button>
      <button onClick={onInvert} className={btnClass}>Invert</button>
      <button onClick={onClear} className={btnClass}>Clear</button>
    </div>
  );
}
