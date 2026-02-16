import { useState } from 'react';
import { X, AlertTriangle, Info } from 'lucide-react';
import { useAppStore } from '@/stores/appStore';

interface ToolSuggestionsProps {
  analysis: { isEncrypted: boolean; pageCount: number; hasMixedPageSizes: boolean } | null;
  currentToolId: string;
}

export function ToolSuggestions({ analysis, currentToolId }: ToolSuggestionsProps) {
  const [dismissed, setDismissed] = useState(false);
  const setView = useAppStore((s) => s.setView);

  if (!analysis || dismissed) return null;

  let message: string | null = null;
  let icon = <Info size={16} />;
  let color = 'bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800';
  let action: (() => void) | null = null;
  let actionLabel = '';

  if (analysis.isEncrypted && currentToolId !== 'unlock') {
    message = 'This PDF is password-protected. Try Unlock PDF first.';
    icon = <AlertTriangle size={16} />;
    color = 'bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800';
    action = () => setView('tool', 'unlock');
    actionLabel = 'Go to Unlock';
  } else if (analysis.pageCount >= 50 && currentToolId !== 'split') {
    message = `Large document (${analysis.pageCount} pages). Split PDF can help extract what you need.`;
  } else if (analysis.hasMixedPageSizes) {
    message = 'This PDF has mixed page sizes. Page Numbers and Watermark will adapt to each page.';
    color = 'bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700';
  } else {
    return null;
  }

  return (
    <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm mb-4 ${color}`}>
      {icon}
      <span className="flex-1">{message}</span>
      {action && <button onClick={action} className="font-medium underline">{actionLabel}</button>}
      <button onClick={() => setDismissed(true)} className="p-0.5 hover:opacity-70" aria-label="Dismiss"><X size={14} /></button>
    </div>
  );
}
