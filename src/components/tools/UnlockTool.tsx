import { useState, useCallback, useMemo } from 'react';
import type { UploadedFile, ToolOutput } from '@/types';
import { workerClient } from '@/lib/pdf-worker-client';
import { useProcessingStore } from '@/stores/processingStore';
import { useAppStore } from '@/stores/appStore';
import { ERRORS } from '@/lib/error-messages';
import { FileDropZone } from '@/components/common/FileDropZone';
import { ProgressBar } from '@/components/common/ProgressBar';
import { PreviewPanel } from '@/components/common/PreviewPanel';
import { DownloadPanel } from '@/components/common/DownloadPanel';
import { ToolSuggestions } from '@/components/common/ToolSuggestions';
import { Unlock, Eye, EyeOff, Info, ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';

export function UnlockTool() {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isEncrypted, setIsEncrypted] = useState<boolean | null>(null);
  const [unlockError, setUnlockError] = useState<string | null>(null);
  const [result, setResult] = useState<ToolOutput | null>(null);

  const status = useProcessingStore((s) => s.status);
  const setView = useAppStore((s) => s.setView);

  const file = files[0] ?? null;

  const analysis = useMemo(() => {
    if (!file) return null;
    return {
      isEncrypted: file.isEncrypted,
      pageCount: file.pageCount,
      hasMixedPageSizes: false,
    };
  }, [file]);

  const canProcess = useMemo(() => {
    if (!file) return false;
    if (!isEncrypted) return false;
    if (password.length === 0) return false;
    return true;
  }, [file, isEncrypted, password]);

  const handleFilesLoaded = useCallback((loaded: UploadedFile[]) => {
    setFiles(loaded);
    setPassword('');
    setUnlockError(null);
    setResult(null);
    useProcessingStore.getState().reset();

    // Check if the uploaded file is encrypted
    const uploadedFile = loaded[0] ?? null;
    if (uploadedFile) {
      setIsEncrypted(uploadedFile.isEncrypted);
    } else {
      setIsEncrypted(null);
    }
  }, []);

  const handleProcess = useCallback(async () => {
    if (!file || !canProcess) return;

    setUnlockError(null);

    try {
      const output = await workerClient.process('unlock', [file.bytes], {
        password,
      });
      setResult(output);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message === ERRORS.WRONG_PASSWORD || message.toLowerCase().includes('password')) {
        setUnlockError(ERRORS.WRONG_PASSWORD);
      } else {
        toast.error(message);
      }
    }
  }, [file, canProcess, password]);

  const handleReset = useCallback(() => {
    setFiles([]);
    setPassword('');
    setShowPassword(false);
    setIsEncrypted(null);
    setUnlockError(null);
    setResult(null);
    useProcessingStore.getState().reset();
  }, []);

  const handleBackToGrid = useCallback(() => {
    setView('grid');
  }, [setView]);

  // Result state
  if (result) {
    return (
      <div className="space-y-4">
        <PreviewPanel result={result} />
        <DownloadPanel result={result} onReset={handleReset} />
      </div>
    );
  }

  // No file loaded
  if (!file) {
    return <FileDropZone onFilesLoaded={handleFilesLoaded} />;
  }

  // File is not encrypted
  if (isEncrypted === false) {
    return (
      <div className="space-y-6">
        <FileDropZone onFilesLoaded={handleFilesLoaded} />

        <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <Info size={20} className="text-blue-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-blue-800">
              This PDF is not password-protected. No action needed.
            </p>
            <p className="text-xs text-blue-600 mt-1">
              Upload a different file or go back to the tool grid.
            </p>
          </div>
        </div>

        <button
          onClick={handleBackToGrid}
          className="flex items-center gap-2 px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-gray-700"
        >
          <ArrowLeft size={16} />
          Back to tools
        </button>
      </div>
    );
  }

  // Encrypted file: show password input
  return (
    <div className="space-y-6">
      <FileDropZone onFilesLoaded={handleFilesLoaded} />

      <ToolSuggestions analysis={analysis} currentToolId="unlock" />

      {/* Password input */}
      <div className="space-y-2">
        <label htmlFor="unlock-password" className="block text-sm font-medium text-gray-700">
          PDF Password
        </label>
        <div className="relative">
          <input
            id="unlock-password"
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setUnlockError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && canProcess) {
                handleProcess();
              }
            }}
            placeholder="Enter the PDF password"
            className={`w-full px-3 py-2 pr-10 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none ${
              unlockError ? 'border-red-300' : 'border-gray-300'
            }`}
          />
          <button
            type="button"
            onClick={() => setShowPassword((prev) => !prev)}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 transition-colors"
            aria-label={showPassword ? 'Hide password' : 'Show password'}
          >
            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
        {unlockError && (
          <p className="text-xs text-red-500">{unlockError}</p>
        )}
      </div>

      <ProgressBar />

      {/* Process button */}
      <button
        onClick={handleProcess}
        disabled={!canProcess || status === 'processing'}
        className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus-ring"
      >
        <Unlock size={16} />
        {status === 'processing' ? 'Processing...' : 'Unlock PDF'}
      </button>
    </div>
  );
}
