import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import type { UploadedFile, ToolOutput } from '@/types';
import { workerClient } from '@/lib/pdf-worker-client';
import { useProcessingStore } from '@/stores/processingStore';
import { parsePageRange } from '@/lib/page-range-parser';
import { renderPageThumbnail } from '@/lib/thumbnail-renderer';
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
  const [pageThumbnail, setPageThumbnail] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

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

  // Load first page thumbnail when file changes
  useEffect(() => {
    if (!file) {
      setPageThumbnail(null);
      return;
    }
    let cancelled = false;
    renderPageThumbnail(file.bytes, 0, 1.0).then((url) => {
      if (!cancelled && url) setPageThumbnail(url);
    });
    return () => { cancelled = true; };
  }, [file]);

  // Draw the watermark simulation on canvas whenever settings change
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;

    ctx.clearRect(0, 0, W, H);

    // Draw background (white page)
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, W, H);

    // Draw thumbnail if available
    if (pageThumbnail) {
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0, W, H);
        drawWatermark(ctx, W, H);
      };
      img.src = pageThumbnail;
    } else {
      // Draw placeholder lines to simulate a page
      ctx.strokeStyle = '#e5e7eb';
      ctx.lineWidth = 1;
      for (let y = 30; y < H - 20; y += 16) {
        const lineW = y < 50 ? W * 0.5 : W * (0.6 + Math.random() * 0.25);
        ctx.beginPath();
        ctx.moveTo(20, y);
        ctx.lineTo(Math.min(20 + lineW, W - 20), y);
        ctx.stroke();
      }
      drawWatermark(ctx, W, H);
    }
  }, [pageThumbnail, text, fontSize, angle, opacity, color, mode]);

  function drawWatermark(ctx: CanvasRenderingContext2D, W: number, H: number) {
    const displayText = text.trim() || 'Watermark';
    ctx.save();
    ctx.globalAlpha = opacity;
    ctx.fillStyle = color;

    // Scale font size relative to canvas (preview is smaller than actual page)
    const scaledFont = Math.max(8, fontSize * (W / 612)); // 612 = typical US Letter width in pts

    if (mode === 'center') {
      ctx.font = `bold ${scaledFont}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.translate(W / 2, H / 2);
      ctx.rotate((-angle * Math.PI) / 180);
      ctx.fillText(displayText, 0, 0);
    } else {
      // Tile mode
      const tileFont = Math.max(6, scaledFont * 0.5);
      ctx.font = `bold ${tileFont}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      const metrics = ctx.measureText(displayText);
      const textW = metrics.width + 40;
      const textH = tileFont + 30;

      for (let x = -W; x < W * 2; x += textW) {
        for (let y = -H; y < H * 2; y += textH) {
          ctx.save();
          ctx.translate(x, y);
          ctx.rotate((-angle * Math.PI) / 180);
          ctx.fillText(displayText, 0, 0);
          ctx.restore();
        }
      }
    }
    ctx.restore();
  }

  const handleFilesLoaded = useCallback((loaded: UploadedFile[]) => {
    setFiles(loaded);
    setResult(null);
    setRangeText('');
    setPageThumbnail(null);
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
    setPageThumbnail(null);
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


  // Configure and process
  return (
    <div className="space-y-6">
      <FileDropZone onFilesLoaded={handleFilesLoaded} />

      {file && (<>

      <ToolSuggestions analysis={analysis} currentToolId="text-watermark" />

      {/* Two-column layout: settings left, preview right */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">

        {/* LEFT COLUMN — Settings */}
        <div className="space-y-5">

          {/* Watermark text */}
          <div className="space-y-2">
            <label htmlFor="watermark-text" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Watermark text
            </label>
            <input
              id="watermark-text"
              type="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Enter watermark text"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
            />
          </div>

          {/* Font size slider */}
          <div className="space-y-2">
            <label htmlFor="wm-font-size" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Font size: <span className="text-indigo-600 dark:text-indigo-400">{fontSize}pt</span>
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
            <div className="flex justify-between text-xs text-gray-400 dark:text-gray-500">
              <span>20pt</span>
              <span>120pt</span>
            </div>
          </div>

          {/* Rotation slider */}
          <div className="space-y-2">
            <label htmlFor="wm-angle" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Rotation: <span className="text-indigo-600 dark:text-indigo-400">{angle}&deg;</span>
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
            <div className="flex justify-between text-xs text-gray-400 dark:text-gray-500">
              <span>-90&deg;</span>
              <span>0&deg;</span>
              <span>90&deg;</span>
            </div>
          </div>

          {/* Opacity slider */}
          <div className="space-y-2">
            <label htmlFor="wm-opacity" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Opacity: <span className="text-indigo-600 dark:text-indigo-400">{Math.round(opacity * 100)}%</span>
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
            <div className="flex justify-between text-xs text-gray-400 dark:text-gray-500">
              <span>5%</span>
              <span>100%</span>
            </div>
          </div>

          {/* Color */}
          <div className="space-y-2">
            <label htmlFor="wm-color" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Color
            </label>
            <div className="flex items-center gap-3">
              <input
                id="wm-color"
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="w-10 h-10 rounded border border-gray-300 dark:border-gray-600 cursor-pointer"
              />
              <span className="text-sm text-gray-500 dark:text-gray-400 font-mono">{color}</span>
            </div>
          </div>

          {/* Mode toggle */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Placement mode</label>
            <div className="flex rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
              <button
                onClick={() => setMode('center')}
                className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
                  mode === 'center'
                    ? 'bg-indigo-600 dark:bg-indigo-500 text-white'
                    : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
              >
                Center
              </button>
              <button
                onClick={() => setMode('tile')}
                className={`flex-1 px-4 py-2 text-sm font-medium transition-colors border-l border-gray-200 dark:border-gray-700 ${
                  mode === 'tile'
                    ? 'bg-indigo-600 dark:bg-indigo-500 text-white'
                    : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
              >
                Tile
              </button>
            </div>
            <p className="text-xs text-gray-400 dark:text-gray-500">
              {mode === 'center'
                ? 'Single watermark placed at the center of each page.'
                : 'Watermark repeated in a tiled pattern across each page.'}
            </p>
          </div>

          {/* Apply to */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Apply to</label>
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
                <span className="text-sm text-gray-700 dark:text-gray-300">All pages</span>
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
                <span className="text-sm text-gray-700 dark:text-gray-300">Page range</span>
              </label>
            </div>

            {applyTo === 'range' && (
              <div className="mt-2">
                <input
                  type="text"
                  value={rangeText}
                  onChange={(e) => setRangeText(e.target.value)}
                  placeholder="e.g., 1-5, 8, 10-end"
                  className={`w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none dark:bg-gray-800 dark:text-gray-100 ${
                    parsedRange?.error ? 'border-red-300 dark:border-red-700' : 'border-gray-300 dark:border-gray-600'
                  }`}
                />
                {parsedRange?.error && (
                  <p className="text-xs text-red-500 dark:text-red-400 mt-1">{parsedRange.error}</p>
                )}
              </div>
            )}
          </div>

          <ProgressBar />

          {/* Process button */}
          <button
            onClick={handleProcess}
            disabled={!canProcess || status === 'processing'}
            className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 dark:bg-indigo-500 text-white font-medium rounded-lg hover:bg-indigo-700 dark:hover:bg-indigo-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus-ring"
          >
            <Droplets size={16} />
            {status === 'processing' ? 'Processing...' : 'Add Watermark'}
          </button>
        </div>

        {/* RIGHT COLUMN — Live watermark preview on first page */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Preview
            <span className="ml-2 text-xs font-normal text-gray-400 dark:text-gray-500">Page 1</span>
          </label>
          <div className="relative rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-4 shadow-inner">
            <div className="relative mx-auto overflow-hidden rounded-lg shadow-md" style={{ maxWidth: 400 }}>
              <canvas
                ref={canvasRef}
                width={400}
                height={566}
                className="w-full h-auto block bg-white"
                data-testid="watermark-preview-canvas"
              />
              {/* Page label */}
              <div className="absolute bottom-2 right-2 bg-black/50 text-white text-[10px] px-2 py-0.5 rounded-full backdrop-blur-sm">
                Page 1 of {file.pageCount}
              </div>
            </div>
          </div>
        </div>

      </div>
      </>)}
    </div>
  );
}
