import { useState, useCallback, useMemo } from 'react';
import type { UploadedFile, ToolOutput } from '@/types';
import { workerClient } from '@/lib/pdf-worker-client';
import { useProcessingStore } from '@/stores/processingStore';
import { FileDropZone } from '@/components/common/FileDropZone';
import { ProgressBar } from '@/components/common/ProgressBar';
import { PreviewPanel } from '@/components/common/PreviewPanel';
import { DownloadPanel } from '@/components/common/DownloadPanel';
import { ToolSuggestions } from '@/components/common/ToolSuggestions';
import { Lock, Eye, EyeOff } from 'lucide-react';
import toast from 'react-hot-toast';

interface Permissions {
  printing: boolean;
  copying: boolean;
  modifying: boolean;
}

type PasswordStrength = 'empty' | 'weak' | 'medium' | 'strong';

function getPasswordStrength(password: string): PasswordStrength {
  if (password.length === 0) return 'empty';
  if (password.length < 6) return 'weak';

  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecial = /[^A-Za-z0-9]/.test(password);
  const mixCount = [hasUpper, hasLower, hasNumber, hasSpecial].filter(Boolean).length;

  if (password.length >= 10 && mixCount >= 3) return 'strong';
  if (mixCount >= 2) return 'medium';
  return 'weak';
}

const STRENGTH_CONFIG: Record<PasswordStrength, { color: string; label: string; width: string }> = {
  empty: { color: 'bg-gray-200', label: '', width: 'w-0' },
  weak: { color: 'bg-red-500', label: 'Weak', width: 'w-1/3' },
  medium: { color: 'bg-yellow-500', label: 'Medium', width: 'w-2/3' },
  strong: { color: 'bg-green-500', label: 'Strong', width: 'w-full' },
};

export function EncryptTool() {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [confirmTouched, setConfirmTouched] = useState(false);
  const [permissions, setPermissions] = useState<Permissions>({
    printing: true,
    copying: true,
    modifying: false,
  });
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

  const strength = useMemo(() => getPasswordStrength(password), [password]);
  const strengthConfig = STRENGTH_CONFIG[strength];

  const passwordsMatch = password === confirmPassword;
  const showMismatch = confirmTouched && !passwordsMatch && confirmPassword.length > 0;

  const canProcess = useMemo(() => {
    if (!file) return false;
    if (password.length === 0) return false;
    if (!passwordsMatch) return false;
    return true;
  }, [file, password, passwordsMatch]);

  const handleFilesLoaded = useCallback((loaded: UploadedFile[]) => {
    setFiles(loaded);
    setResult(null);
    useProcessingStore.getState().reset();
  }, []);

  const handlePermissionChange = useCallback((key: keyof Permissions) => {
    setPermissions((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const handleProcess = useCallback(async () => {
    if (!file || !canProcess) return;

    try {
      const output = await workerClient.process('encrypt', [file.bytes], {
        userPassword: password,
        ownerPassword: password,
        permissions,
      });
      setResult(output);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      toast.error(message);
    }
  }, [file, canProcess, password, permissions]);

  const handleReset = useCallback(() => {
    setFiles([]);
    setPassword('');
    setConfirmPassword('');
    setShowPassword(false);
    setConfirmTouched(false);
    setPermissions({ printing: true, copying: true, modifying: false });
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

  // No file loaded
  if (!file) {
    return <FileDropZone onFilesLoaded={handleFilesLoaded} />;
  }

  // Configure and process
  return (
    <div className="space-y-6">
      <FileDropZone onFilesLoaded={handleFilesLoaded} />

      <ToolSuggestions analysis={analysis} currentToolId="encrypt" />

      {/* Password input */}
      <div className="space-y-2">
        <label htmlFor="encrypt-password" className="block text-sm font-medium text-gray-700">
          Password
        </label>
        <div className="relative">
          <input
            id="encrypt-password"
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter password"
            className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
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

        {/* Password strength indicator */}
        {password.length > 0 && (
          <div className="space-y-1">
            <div className="h-1.5 w-full bg-gray-200 rounded-full overflow-hidden">
              <div
                className={`h-full ${strengthConfig.color} ${strengthConfig.width} rounded-full transition-all duration-300`}
              />
            </div>
            <p className={`text-xs ${
              strength === 'weak' ? 'text-red-500' :
              strength === 'medium' ? 'text-yellow-600' :
              'text-green-600'
            }`}>
              {strengthConfig.label}
            </p>
          </div>
        )}
      </div>

      {/* Confirm password input */}
      <div className="space-y-2">
        <label htmlFor="encrypt-confirm-password" className="block text-sm font-medium text-gray-700">
          Confirm password
        </label>
        <div className="relative">
          <input
            id="encrypt-confirm-password"
            type={showPassword ? 'text' : 'password'}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            onBlur={() => setConfirmTouched(true)}
            placeholder="Confirm password"
            className={`w-full px-3 py-2 pr-10 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none ${
              showMismatch ? 'border-red-300' : 'border-gray-300'
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
        {showMismatch && (
          <p className="text-xs text-red-500">Passwords do not match.</p>
        )}
      </div>

      {/* Permissions */}
      <div className="space-y-3">
        <label className="block text-sm font-medium text-gray-700">Permissions</label>
        <div className="space-y-2">
          <label className="flex items-center gap-3 text-sm text-gray-700 cursor-pointer">
            <input
              type="checkbox"
              checked={permissions.printing}
              onChange={() => handlePermissionChange('printing')}
              className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
            />
            Allow printing
          </label>
          <label className="flex items-center gap-3 text-sm text-gray-700 cursor-pointer">
            <input
              type="checkbox"
              checked={permissions.copying}
              onChange={() => handlePermissionChange('copying')}
              className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
            />
            Allow copying text
          </label>
          <label className="flex items-center gap-3 text-sm text-gray-700 cursor-pointer">
            <input
              type="checkbox"
              checked={permissions.modifying}
              onChange={() => handlePermissionChange('modifying')}
              className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
            />
            Allow editing
          </label>
        </div>
      </div>

      {/* Encryption info */}
      <p className="text-xs text-gray-400">AES-128 encryption</p>

      <ProgressBar />

      {/* Process button */}
      <button
        onClick={handleProcess}
        disabled={!canProcess || status === 'processing'}
        className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus-ring"
      >
        <Lock size={16} />
        {status === 'processing' ? 'Processing...' : 'Encrypt PDF'}
      </button>
    </div>
  );
}
