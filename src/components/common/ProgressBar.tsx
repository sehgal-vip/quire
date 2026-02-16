import { useProcessingStore } from '@/stores/processingStore';
import { X, Check } from 'lucide-react';
import { workerClient } from '@/lib/pdf-worker-client';

export function ProgressBar() {
  const { status, progress, error } = useProcessingStore();

  if (status === 'idle') return null;

  const percent = progress && progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : null;
  const isDone = status === 'done';
  const isError = status === 'error';

  return (
    <div className="mb-4" role="progressbar" aria-valuenow={percent ?? (isDone ? 100 : 0)} aria-valuemin={0} aria-valuemax={100} aria-label={isDone ? 'Processing complete' : isError ? 'Processing failed' : 'Processing'}>
      <div className="h-1 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        {isDone ? (
          <div className="h-full bg-green-500 w-full transition-all duration-300" />
        ) : isError ? (
          <div className="h-full bg-red-500 w-full" />
        ) : percent !== null ? (
          <div className="h-full bg-indigo-500 transition-all duration-300" style={{ width: `${percent}%` }} />
        ) : (
          <div className="h-full bg-indigo-500 animate-pulse w-full" />
        )}
      </div>
      <div className="flex items-center justify-between mt-1.5">
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {isDone && <span className="text-green-600 dark:text-green-400 flex items-center gap-1"><Check size={12} /> Done</span>}
          {isError && <span className="text-red-600 dark:text-red-400">{error}</span>}
          {status === 'processing' && progress && `${progress.step} ${progress.current} of ${progress.total}...`}
          {status === 'processing' && !progress && 'Processing...'}
          {status === 'cancelled' && 'Cancelled'}
        </p>
        {status === 'processing' && (
          <button
            onClick={() => workerClient.cancelAll()}
            className="text-xs text-gray-400 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400 flex items-center gap-1 transition-colors"
            aria-label="Cancel processing"
          >
            <X size={12} /> Cancel
          </button>
        )}
      </div>
    </div>
  );
}
