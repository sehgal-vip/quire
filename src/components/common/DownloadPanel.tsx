import type { ToolOutput } from '@/types';
import { downloadFile, downloadAsZip } from '@/lib/download-utils';
import { Download, RefreshCw } from 'lucide-react';

interface DownloadPanelProps {
  result: ToolOutput;
  onReset: () => void;
}

export function DownloadPanel({ result, onReset }: DownloadPanelProps) {
  const isSingle = result.files.length === 1;

  return (
    <div className="flex flex-wrap items-center gap-3 mt-4">
      {isSingle ? (
        <button
          onClick={() => downloadFile(result.files[0])}
          className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition-colors focus-ring"
        >
          <Download size={16} /> Download
        </button>
      ) : (
        <>
          <button
            onClick={() => downloadAsZip(result.files, 'quire-output.zip')}
            className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition-colors focus-ring"
          >
            <Download size={16} /> Download All as ZIP
          </button>
          {result.files.map((f, i) => (
            <button
              key={i}
              onClick={() => downloadFile(f)}
              className="px-3 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              {f.name}
            </button>
          ))}
        </>
      )}
      <button
        onClick={onReset}
        className="flex items-center gap-2 px-4 py-2.5 text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors focus-ring"
      >
        <RefreshCw size={16} /> Process another file
      </button>
    </div>
  );
}
