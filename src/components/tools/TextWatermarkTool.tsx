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
import { Droplets } from 'lucide-react';
import toast from 'react-hot-toast';

type WatermarkMode = 'center' | 'tile';
type ApplyTo = 'all' | 'range';

export function TextWatermarkTool() {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [text, setText] = useState('CONFIDENTIAL');
  const [fontSize, setFontSize] = useState(60);
  const [angle, setAngle] = useState(45);
  const [opacity, setOpacity] = useState(0.15);
  const [color, setColor] = useState('#808080');
  const [mode, setMode] = useState<WatermarkMode>('center');
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
    if (!text.trim()) return false;
    if (applyTo === 'range') {
      if (!parsedRange || parsedRange.error || parsedRange.pages.length === 0) return false;
    }
    return true;
  }, [file, text, applyTo, parsedRange]);

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
        text: text.trim(),
        fontSize,
        angle,
        opacity,
        color,
        mode,
      };
      if (computedRange) {
        options.pageRange = computedRange;
      }
      const output = await workerClient.process('add-watermark', [file.bytes], options);
      setResult(output);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      toast.error(message);
    }
  }, [file, canProcess, text, fontSize, angle, opacity, color, mode, computedRange]);

  const handleReset = useCallback(() => {
    setFiles([]);
    setText('CONFIDENTIAL');
    setFontSize(60);
    setAngle(45);
    setOpacity(0.15);
    setColor('#808080');
    setMode('center');
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

      <ToolSuggestions analysis={analysis} currentToolId="text-watermark" />

      {/* Watermark text */}
      <div className="space-y-2">
        <label htmlFor="watermark-text" className="block text-sm font-medium text-gray-700">
          Watermark text
        </label>
        <input
          id="watermark-text"
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Enter watermark text"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
        />
      </div>

      {/* Font size slider */}
      <div className="space-y-2">
        <label htmlFor="wm-font-size" className="block text-sm font-medium text-gray-700">
          Font size: <span className="text-indigo-600">{fontSize}pt</span>
        </label>
        <input
          id="wm-font-size"
          type="range"
          min={20}
          max={120}
          value={fontSize}
          onChange={(e) => setFontSize(parseInt(e.target.value, 10))}
          className="w-full accent-indigo-600"
        />
        <div className="flex justify-between text-xs text-gray-400">
          <span>20pt</span>
          <span>120pt</span>
        </div>
      </div>

      {/* Rotation slider */}
      <div className="space-y-2">
        <label htmlFor="wm-angle" className="block text-sm font-medium text-gray-700">
          Rotation: <span className="text-indigo-600">{angle}&deg;</span>
        </label>
        <input
          id="wm-angle"
          type="range"
          min={-90}
          max={90}
          value={angle}
          onChange={(e) => setAngle(parseInt(e.target.value, 10))}
          className="w-full accent-indigo-600"
        />
        <div className="flex justify-between text-xs text-gray-400">
          <span>-90&deg;</span>
          <span>0&deg;</span>
          <span>90&deg;</span>
        </div>
      </div>

      {/* Opacity slider */}
      <div className="space-y-2">
        <label htmlFor="wm-opacity" className="block text-sm font-medium text-gray-700">
          Opacity: <span className="text-indigo-600">{Math.round(opacity * 100)}%</span>
        </label>
        <input
          id="wm-opacity"
          type="range"
          min={0.05}
          max={1.0}
          step={0.05}
          value={opacity}
          onChange={(e) => setOpacity(parseFloat(e.target.value))}
          className="w-full accent-indigo-600"
        />
        <div className="flex justify-between text-xs text-gray-400">
          <span>5%</span>
          <span>100%</span>
        </div>
      </div>

      {/* Color */}
      <div className="space-y-2">
        <label htmlFor="wm-color" className="block text-sm font-medium text-gray-700">
          Color
        </label>
        <div className="flex items-center gap-3">
          <input
            id="wm-color"
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="w-10 h-10 rounded border border-gray-300 cursor-pointer"
          />
          <span className="text-sm text-gray-500 font-mono">{color}</span>
        </div>
      </div>

      {/* Mode toggle */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700">Placement mode</label>
        <div className="flex rounded-lg border border-gray-200 overflow-hidden">
          <button
            onClick={() => setMode('center')}
            className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
              mode === 'center'
                ? 'bg-indigo-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            Center
          </button>
          <button
            onClick={() => setMode('tile')}
            className={`flex-1 px-4 py-2 text-sm font-medium transition-colors border-l border-gray-200 ${
              mode === 'tile'
                ? 'bg-indigo-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            Tile
          </button>
        </div>
        <p className="text-xs text-gray-400">
          {mode === 'center'
            ? 'Single watermark placed at the center of each page.'
            : 'Watermark repeated in a tiled pattern across each page.'}
        </p>
      </div>

      {/* Apply to */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700">Apply to</label>
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="wm-applyTo"
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
              name="wm-applyTo"
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

      {/* Visual preview box */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700">Preview</label>
        <div className="relative w-full h-48 bg-white border border-gray-200 rounded-lg overflow-hidden flex items-center justify-center">
          {mode === 'center' ? (
            <span
              className="select-none font-bold whitespace-nowrap"
              style={{
                fontSize: `${Math.min(fontSize, 48)}px`,
                color: color,
                opacity: opacity,
                transform: `rotate(-${angle}deg)`,
              }}
            >
              {text || 'Watermark'}
            </span>
          ) : (
            <div
              className="absolute inset-0 flex flex-wrap items-center justify-center gap-8 p-4"
              style={{ opacity: opacity }}
            >
              {Array.from({ length: 9 }).map((_, i) => (
                <span
                  key={i}
                  className="select-none font-bold whitespace-nowrap"
                  style={{
                    fontSize: `${Math.min(fontSize * 0.5, 24)}px`,
                    color: color,
                    transform: `rotate(-${angle}deg)`,
                  }}
                >
                  {text || 'Watermark'}
                </span>
              ))}
            </div>
          )}
          {/* Page outline */}
          <div className="absolute inset-3 border-2 border-dashed border-gray-200 rounded pointer-events-none" />
        </div>
      </div>

      <ProgressBar />

      {/* Process button */}
      <button
        onClick={handleProcess}
        disabled={!canProcess || status === 'processing'}
        className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus-ring"
      >
        <Droplets size={16} />
        {status === 'processing' ? 'Processing...' : 'Add Watermark'}
      </button>
    </div>
  );
}
