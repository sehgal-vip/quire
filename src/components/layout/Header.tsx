import { HelpCircle } from 'lucide-react';

interface HeaderProps {
  onShowShortcuts: () => void;
}

export function Header({ onShowShortcuts }: HeaderProps) {
  return (
    <header className="h-14 flex items-center justify-between px-4 bg-white border-b border-gray-200">
      <h1 className="text-2xl font-bold text-indigo-600">Quire</h1>
      <button
        onClick={onShowShortcuts}
        className="p-2 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors focus-ring"
        aria-label="Keyboard shortcuts"
      >
        <HelpCircle size={20} />
      </button>
    </header>
  );
}
