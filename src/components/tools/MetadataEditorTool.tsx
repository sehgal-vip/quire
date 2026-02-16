import { useState, useCallback, useMemo } from 'react';
import type { UploadedFile, ToolOutput } from '@/types';
import { workerClient } from '@/lib/pdf-worker-client';
import { useProcessingStore } from '@/stores/processingStore';
import { FileDropZone } from '@/components/common/FileDropZone';
import { ProgressBar } from '@/components/common/ProgressBar';
import { PreviewPanel } from '@/components/common/PreviewPanel';
import { DownloadPanel } from '@/components/common/DownloadPanel';
import { ToolSuggestions } from '@/components/common/ToolSuggestions';
import { FileText, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';

interface PdfMetadata {
  title: string;
  author: string;
  subject: string;
  keywords: string;
  creator: string;
  producer: string;
}

const EMPTY_METADATA: PdfMetadata = {
  title: '',
  author: '',
  subject: '',
  keywords: '',
  creator: '',
  producer: '',
};

const METADATA_FIELDS: { key: keyof PdfMetadata; label: string; placeholder: string }[] = [
  { key: 'title', label: 'Title', placeholder: 'Document title' },
  { key: 'author', label: 'Author', placeholder: 'Author name' },
  { key: 'subject', label: 'Subject', placeholder: 'Document subject' },
  { key: 'keywords', label: 'Keywords', placeholder: 'Comma-separated keywords' },
  { key: 'creator', label: 'Creator', placeholder: 'Application that created the document' },
  { key: 'producer', label: 'Producer', placeholder: 'PDF producer' },
];

export function MetadataEditorTool() {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [metadata, setMetadata] = useState<PdfMetadata>({ ...EMPTY_METADATA });
  const [result, setResult] = useState<ToolOutput | null>(null);

  const status = useProcessingStore((s) => s.status);

  const file = files[0] ?? null;

  const analysis = useMemo(() => {
    if (!file) return null;
    return {
      isEncrypted: file.isEncrypted,
      pageCount: file.pageCount,
      hasMixedPageSizes: false,
    };
  }, [file]);

  const handleFilesLoaded = useCallback((loaded: UploadedFile[]) => {
    setFiles(loaded);
    setMetadata({ ...EMPTY_METADATA });
    setResult(null);
    useProcessingStore.getState().reset();
  }, []);

  const handleFieldChange = useCallback((key: keyof PdfMetadata, value: string) => {
    setMetadata((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handleProcess = useCallback(async () => {
    if (!file) return;

    try {
      const output = await workerClient.process('edit-metadata', [file.bytes], {
        ...metadata,
        clearAll: false,
      });
      setResult(output);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      toast.error(message);
    }
  }, [file, metadata]);

  const handleClearAndProcess = useCallback(async () => {
    if (!file) return;

    try {
      const output = await workerClient.process('edit-metadata', [file.bytes], {
        clearAll: true,
      });
      setResult(output);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      toast.error(message);
    }
  }, [file]);

  const handleReset = useCallback(() => {
    setFiles([]);
    setMetadata({ ...EMPTY_METADATA });
    setResult(null);
    useProcessingStore.getState().reset();
  }, []);

  // Result state
  if (result) {
    return (
      <div className="space-y-4">
        <PreviewPanel result={result} />
        <DownloadPanel result={result} onReset={handleReset} />
      </div>
    );
  }


  // Configure and process
  return (
    <div className="space-y-6">
      <FileDropZone onFilesLoaded={handleFilesLoaded} />

      {file && (<>

      <ToolSuggestions analysis={analysis} currentToolId="edit-metadata" />

      {/* Top toolbar */}
      <div className="flex items-center justify-end">
        <button
          onClick={handleProcess}
          disabled={!file || status === 'processing'}
          className="flex items-center gap-1.5 px-4 py-1.5 text-sm font-medium bg-indigo-600 dark:bg-indigo-500 text-white rounded-lg hover:bg-indigo-700 dark:hover:bg-indigo-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <FileText size={14} />
          {status === 'processing' ? 'Processing...' : 'Save Changes'}
        </button>
      </div>

      {/* Info note */}
      <p className="text-xs text-gray-400 dark:text-gray-500">
        Enter the metadata you want to set. Existing metadata will be replaced.
      </p>

      {/* Metadata fields */}
      <div className="space-y-4">
        {METADATA_FIELDS.map(({ key, label, placeholder }) => (
          <div key={key} className="space-y-1">
            <label htmlFor={`metadata-${key}`} className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              {label}
            </label>
            <input
              id={`metadata-${key}`}
              type="text"
              value={metadata[key]}
              onChange={(e) => handleFieldChange(key, e.target.value)}
              placeholder={placeholder}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
            />
          </div>
        ))}
      </div>

      {/* Clear all metadata button */}
      <button
        onClick={handleClearAndProcess}
        disabled={status === 'processing'}
        className="flex items-center gap-2 px-4 py-2 text-sm border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-950 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <Trash2 size={14} />
        Clear all metadata
      </button>

      <ProgressBar />

      {/* Process button */}
      <button
        onClick={handleProcess}
        disabled={!file || status === 'processing'}
        className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 dark:bg-indigo-500 text-white font-medium rounded-lg hover:bg-indigo-700 dark:hover:bg-indigo-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus-ring"
      >
        <FileText size={16} />
        {status === 'processing' ? 'Processing...' : 'Save Changes'}
      </button>      </>)}
    </div>
  );
}