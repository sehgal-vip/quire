import { useState, useCallback, useMemo } from 'react';
import type { UploadedFile, ToolOutput } from '@/types';
import { workerClient } from '@/lib/pdf-worker-client';
import { useProcessingStore } from '@/stores/processingStore';
import { parsePageRange } from '@/lib/page-range-parser';
import { FileDropZone } from '@/components/common/FileDropZone';
import { ProgressBar } from '@/components/common/ProgressBar';
import { PreviewPanel } from '@/components/common/PreviewPanel';
import { DownloadPanel } from '@/components/common/DownloadPanel';
import { ToolSuggestions } from '@/components/common/ToolSuggestions';
import { Hash } from 'lucide-react';
import toast from 'react-hot-toast';

type NumberPosition =
  | 'top-left' | 'top-center' | 'top-right'
  | 'middle-left' | 'middle-center' | 'middle-right'
  | 'bottom-left' | 'bottom-center' | 'bottom-right';

type NumberFormat = '1' | 'Page 1' | 'Page 1 of N' | '1/N' | 'roman';

type ApplyTo = 'all' | 'range';

const POSITION_GRID: { label: string; value: NumberPosition }[][] = [
  [
    { label: 'TL', value: 'top-left' },
    { label: 'TC', value: 'top-center' },
    { label: 'TR', value: 'top-right' },
  ],
  [
    { label: 'ML', value: 'middle-left' },
    { label: 'MC', value: 'middle-center' },
    { label: 'MR', value: 'middle-right' },
  ],
  [
    { label: 'BL', value: 'bottom-left' },
    { label: 'BC', value: 'bottom-center' },
    { label: 'BR', value: 'bottom-right' },
  ],
];

const FORMAT_OPTIONS: { value: NumberFormat; label: string }[] = [
  { value: '1', label: '1' },
  { value: 'Page 1', label: 'Page 1' },
  { value: 'Page 1 of N', label: 'Page 1 of N' },
  { value: '1/N', label: '1/N' },
  { value: 'roman', label: 'i, ii, iii' },
];

function toRoman(num: number): string {
  const vals = [1000, 900, 500, 400, 100, 90, 50, 40, 10, 9, 5, 4, 1];
  const syms = ['m', 'cm', 'd', 'cd', 'c', 'xc', 'l', 'xl', 'x', 'ix', 'v', 'iv', 'i'];
  let result = '';
  for (let i = 0; i < vals.length; i++) {
    while (num >= vals[i]) {
      result += syms[i];
      num -= vals[i];
    }
  }
  return result;
}

function formatPreview(format: NumberFormat, pageNum: number, totalPages: number): string {
  switch (format) {
    case '1': return `${pageNum}`;
    case 'Page 1': return `Page ${pageNum}`;
    case 'Page 1 of N': return `Page ${pageNum} of ${totalPages}`;
    case '1/N': return `${pageNum}/${totalPages}`;
    case 'roman': return toRoman(pageNum);
  }
}

function positionLabel(pos: NumberPosition): string {
  return pos.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

export function PageNumbersTool() {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [position, setPosition] = useState<NumberPosition>('bottom-center');
  const [format, setFormat] = useState<NumberFormat>('1');
  const [startNumber, setStartNumber] = useState(1);
  const [fontSize, setFontSize] = useState(12);
  const [color, setColor] = useState('#000000');
  const [margin, setMargin] = useState(40);
  const [applyTo, setApplyTo] = useState<ApplyTo>('all');
  const [rangeText, setRangeText] = useState('');
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

  const parsedRange = useMemo(() => {
    if (applyTo !== 'range' || !file || !rangeText.trim()) return null;
    return parsePageRange(rangeText, file.pageCount);
  }, [applyTo, file, rangeText]);

  const computedRange = useMemo(() => {
    if (applyTo === 'all' || !parsedRange || parsedRange.error) return undefined;
    // Convert 1-indexed to 0-indexed
    return parsedRange.pages.map((p) => p - 1);
  }, [applyTo, parsedRange]);

  const canProcess = useMemo(() => {
    if (!file) return false;
    if (applyTo === 'range') {
      if (!parsedRange || parsedRange.error || parsedRange.pages.length === 0) return false;
    }
    return true;
  }, [file, applyTo, parsedRange]);

  const previewText = useMemo(() => {
    if (!file) return '';
    const total = file.pageCount;
    const samples = Math.min(3, total);
    const parts: string[] = [];
    for (let i = 0; i < samples; i++) {
      parts.push(formatPreview(format, startNumber + i, startNumber + total - 1));
    }
    if (total > 3) parts.push('...');
    return parts.join(', ');
  }, [file, format, startNumber]);

  const handleFilesLoaded = useCallback((loaded: UploadedFile[]) => {
    setFiles(loaded);
    setResult(null);
    setRangeText('');
    useProcessingStore.getState().reset();
  }, []);

  const handleProcess = useCallback(async () => {
    if (!file || !canProcess) return;

    try {
      const options: Record<string, unknown> = {
        position,
        format,
        startNumber,
        fontSize,
        color,
        margin,
      };
      if (computedRange) {
        options.pageRange = computedRange;
      }
      const output = await workerClient.process('add-page-numbers', [file.bytes], options);
      setResult(output);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      toast.error(message);
    }
  }, [file, canProcess, position, format, startNumber, fontSize, color, margin, computedRange]);

  const handleReset = useCallback(() => {
    setFiles([]);
    setPosition('bottom-center');
    setFormat('1');
    setStartNumber(1);
    setFontSize(12);
    setColor('#000000');
    setMargin(40);
    setApplyTo('all');
    setRangeText('');
    setResult(null);
    useProcessingStore.getState().reset();
  }, []);

  // Result state
  if (result) {
    return (
      <div className="space-y-4">
        <PreviewPanel result={result} originalBytes={file?.bytes} showOriginalToggle />
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

      <ToolSuggestions analysis={analysis} currentToolId="page-numbers" />

      {/* Position grid */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700">Position</label>
        <div className="inline-grid grid-cols-3 gap-1 border border-gray-200 rounded-lg p-2 bg-gray-50">
          {POSITION_GRID.map((row) =>
            row.map((cell) => (
              <button
                key={cell.value}
                onClick={() => setPosition(cell.value)}
                className={`w-12 h-10 text-xs font-medium rounded transition-colors ${
                  position === cell.value
                    ? 'bg-indigo-600 text-white'
                    : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-100'
                }`}
                title={positionLabel(cell.value)}
              >
                {cell.label}
              </button>
            ))
          )}
        </div>
        <p className="text-xs text-gray-400">Selected: {positionLabel(position)}</p>
      </div>

      {/* Format */}
      <div className="space-y-2">
        <label htmlFor="num-format" className="block text-sm font-medium text-gray-700">
          Number format
        </label>
        <select
          id="num-format"
          value={format}
          onChange={(e) => setFormat(e.target.value as NumberFormat)}
          className="w-48 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none bg-white"
        >
          {FORMAT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Starting number */}
      <div className="space-y-2">
        <label htmlFor="start-number" className="block text-sm font-medium text-gray-700">
          Starting number
        </label>
        <input
          id="start-number"
          type="number"
          min={1}
          value={startNumber}
          onChange={(e) => setStartNumber(Math.max(1, parseInt(e.target.value, 10) || 1))}
          className="w-24 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
        />
      </div>

      {/* Font size slider */}
      <div className="space-y-2">
        <label htmlFor="font-size" className="block text-sm font-medium text-gray-700">
          Font size: <span className="text-indigo-600">{fontSize}pt</span>
        </label>
        <input
          id="font-size"
          type="range"
          min={8}
          max={36}
          value={fontSize}
          onChange={(e) => setFontSize(parseInt(e.target.value, 10))}
          className="w-full accent-indigo-600"
        />
        <div className="flex justify-between text-xs text-gray-400">
          <span>8pt</span>
          <span>36pt</span>
        </div>
      </div>

      {/* Color */}
      <div className="space-y-2">
        <label htmlFor="num-color" className="block text-sm font-medium text-gray-700">
          Color
        </label>
        <div className="flex items-center gap-3">
          <input
            id="num-color"
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="w-10 h-10 rounded border border-gray-300 cursor-pointer"
          />
          <span className="text-sm text-gray-500 font-mono">{color}</span>
        </div>
      </div>

      {/* Margin slider */}
      <div className="space-y-2">
        <label htmlFor="margin" className="block text-sm font-medium text-gray-700">
          Margin from edge: <span className="text-indigo-600">{margin}pt</span>
        </label>
        <input
          id="margin"
          type="range"
          min={20}
          max={100}
          value={margin}
          onChange={(e) => setMargin(parseInt(e.target.value, 10))}
          className="w-full accent-indigo-600"
        />
        <div className="flex justify-between text-xs text-gray-400">
          <span>20pt</span>
          <span>100pt</span>
        </div>
      </div>

      {/* Apply to */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700">Apply to</label>
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="applyTo"
              value="all"
              checked={applyTo === 'all'}
              onChange={() => setApplyTo('all')}
              className="text-indigo-600 focus:ring-indigo-500"
            />
            <span className="text-sm text-gray-700">All pages</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="applyTo"
              value="range"
              checked={applyTo === 'range'}
              onChange={() => setApplyTo('range')}
              className="text-indigo-600 focus:ring-indigo-500"
            />
            <span className="text-sm text-gray-700">Page range</span>
          </label>
        </div>

        {applyTo === 'range' && (
          <div className="mt-2">
            <input
              type="text"
              value={rangeText}
              onChange={(e) => setRangeText(e.target.value)}
              placeholder="e.g., 1-5, 8, 10-end"
              className={`w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none ${
                parsedRange?.error ? 'border-red-300' : 'border-gray-300'
              }`}
            />
            {parsedRange?.error && (
              <p className="text-xs text-red-500 mt-1">{parsedRange.error}</p>
            )}
          </div>
        )}
      </div>

      {/* Live text preview */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-sm text-gray-600">
        <span className="font-medium text-gray-700">Preview: </span>
        {positionLabel(position)}: {previewText}
      </div>

      <ProgressBar />

      {/* Process button */}
      <button
        onClick={handleProcess}
        disabled={!canProcess || status === 'processing'}
        className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus-ring"
      >
        <Hash size={16} />
        {status === 'processing' ? 'Processing...' : 'Add Page Numbers'}
      </button>
    </div>
  );
}
