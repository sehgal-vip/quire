import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { SHORTCUTS } from '@/lib/keyboard-shortcuts';

interface KeyboardShortcutsHelpProps {
  isOpen: boolean;
  onClose: () => void;
}

export function KeyboardShortcutsHelp({ isOpen, onClose }: KeyboardShortcutsHelpProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    ref.current?.focus();
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div ref={ref} className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full mx-4 p-6" onClick={(e) => e.stopPropagation()} tabIndex={-1}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Keyboard Shortcuts</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded" aria-label="Close"><X size={18} /></button>
        </div>
        <table className="w-full text-sm">
          <tbody>
            {SHORTCUTS.map((s) => (
              <tr key={s.action} className="border-t border-gray-100 dark:border-gray-700">
                <td className="py-2 pr-4">
                  <kbd className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded text-xs font-mono">
                    {s.ctrl && (navigator.platform.includes('Mac') ? '\u2318' : 'Ctrl+')}{s.shift ? 'Shift+' : ''}{s.key}
                  </kbd>
                </td>
                <td className="py-2 text-gray-600 dark:text-gray-400">{s.description}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
