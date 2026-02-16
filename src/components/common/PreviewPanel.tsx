import { useState, useEffect } from 'react';
import type { ToolOutput } from '@/types';
import { renderPageThumbnail } from '@/lib/thumbnail-renderer';
import { formatFileSize } from '@/lib/download-utils';
import { formatDuration } from '@/lib/time-estimator';
import { Eye, EyeOff } from 'lucide-react';

interface PreviewPanelProps {
  result: ToolOutput;
  originalBytes?: Uint8Array;
  showOriginalToggle?: boolean;
}

export function PreviewPanel({ result, originalBytes, showOriginalToggle }: PreviewPanelProps) {
  const [thumbnail, setThumbnail] = useState<string | null>(null);
  const [showOriginal, setShowOriginal] = useState(false);

  const displayBytes = showOriginal && originalBytes ? originalBytes : result.files[0]?.bytes;

  useEffect(() => {
    if (displayBytes) {
      renderPageThumbnail(displayBytes, 0, 0.6).then(setThumbnail);
    }
  }, [displayBytes]);

  const totalSize = result.files.reduce((s, f) => s + f.bytes.length, 0);
  const originalSize = originalBytes?.length ?? 0;
  const sizeDiff = originalSize > 0 ? ((totalSize - originalSize) / originalSize) * 100 : 0;

  return (
    <div className="bg-gray-50 rounded-xl p-4 space-y-3">
      <div className="flex gap-4">
        {thumbnail && (
          <div className="w-24 h-32 rounded-lg overflow-hidden border border-gray-200 shrink-0 bg-white">
            <img src={thumbnail} alt="Preview" className="w-full h-full object-contain" />
          </div>
        )}
        <div className="space-y-1.5">
          {result.files.length === 1 && (
            <>
              <p className="text-sm font-medium text-gray-900">{result.files[0].name}</p>
              <p className="text-xs text-gray-500">{result.files[0].pageCount} pages · {formatFileSize(result.files[0].bytes.length)}</p>
            </>
          )}
          {result.files.length > 1 && (
            <>
              <p className="text-sm font-medium text-gray-900">{result.files.length} files</p>
              <p className="text-xs text-gray-500">Total: {formatFileSize(totalSize)}</p>
            </>
          )}
          {originalSize > 0 && (
            <p className={`text-xs ${sizeDiff < 0 ? 'text-green-600' : 'text-gray-500'}`}>
              {sizeDiff < 0 ? `↓ ${Math.abs(sizeDiff).toFixed(0)}% smaller` : sizeDiff > 5 ? `↑ ${sizeDiff.toFixed(0)}% larger` : 'Similar size'}
            </p>
          )}
          <p className="text-xs text-gray-400">Completed in {formatDuration(result.processingTime)}</p>
        </div>
      </div>
      {showOriginalToggle && originalBytes && (
        <button
          onClick={() => setShowOriginal(!showOriginal)}
          className="flex items-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-700"
        >
          {showOriginal ? <EyeOff size={12} /> : <Eye size={12} />}
          {showOriginal ? 'Show processed' : 'Show original'}
        </button>
      )}

      {result.files.length > 1 && (
        <div className="space-y-1.5 pt-2 border-t border-gray-200">
          {result.files.map((f, i) => (
            <div key={i} className="flex items-center justify-between text-xs">
              <span className="text-gray-700 truncate">{f.name}</span>
              <span className="text-gray-400 shrink-0 ml-2">{f.pageCount}p · {formatFileSize(f.bytes.length)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
