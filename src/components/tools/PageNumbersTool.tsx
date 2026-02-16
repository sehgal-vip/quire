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

/** Map a position key to {x, y, textAlign, textBaseline} for canvas drawing */
function getPositionCoords(
  pos: NumberPosition,
  W: number,
  H: number,
  marginPx: number,
): { x: number; y: number; align: CanvasTextAlign; baseline: CanvasTextBaseline } {
  const [row, col] = pos.split('-') as [string, string];
  let x: number, y: number;
  let align: CanvasTextAlign;
  let baseline: CanvasTextBaseline;

  if (col === 'left') { x = marginPx; align = 'left'; }
  else if (col === 'right') { x = W - marginPx; align = 'right'; }
  else { x = W / 2; align = 'center'; }

  if (row === 'top') { y = marginPx; baseline = 'top'; }
  else if (row === 'bottom') { y = H - marginPx; baseline = 'bottom'; }
  else { y = H / 2; baseline = 'middle'; }

  return { x, y, align, baseline };
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

  const pageNumberText = useMemo(() => {
    if (!file) return '';
    return formatPreview(format, startNumber, startNumber + file.pageCount - 1);
  }, [file, format, startNumber]);

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

  // Load first page thumbnail
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

  // Draw preview canvas: page thumbnail + page number text only (zones handled by HTML overlay)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;

    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, W, H);

    const drawPageNumber = () => {
      if (!pageNumberText) return;

      const scaledMargin = margin * (W / 612);
      const scaledFont = Math.max(10, fontSize * (W / 612));
      const coords = getPositionCoords(position, W, H, scaledMargin);

      // Draw pill background behind text
      ctx.font = `bold ${scaledFont}px sans-serif`;
      ctx.textAlign = coords.align;
      ctx.textBaseline = coords.baseline;

      const metrics = ctx.measureText(pageNumberText);
      const textW = metrics.width;
      const textH = scaledFont;
      let pillX = coords.x;
      if (coords.align === 'center') pillX -= textW / 2;
      else if (coords.align === 'right') pillX -= textW;
      let pillY = coords.y;
      if (coords.baseline === 'middle') pillY -= textH / 2;
      else if (coords.baseline === 'bottom') pillY -= textH;

      const pillPad = 5;
      const px = pillX - pillPad;
      const py = pillY - pillPad / 2;
      const pw = textW + pillPad * 2;
      const ph = textH + pillPad;
      const pr = 4;

      ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
      ctx.beginPath();
      ctx.moveTo(px + pr, py);
      ctx.lineTo(px + pw - pr, py);
      ctx.quadraticCurveTo(px + pw, py, px + pw, py + pr);
      ctx.lineTo(px + pw, py + ph - pr);
      ctx.quadraticCurveTo(px + pw, py + ph, px + pw - pr, py + ph);
      ctx.lineTo(px + pr, py + ph);
      ctx.quadraticCurveTo(px, py + ph, px, py + ph - pr);
      ctx.lineTo(px, py + pr);
      ctx.quadraticCurveTo(px, py, px + pr, py);
      ctx.closePath();
      ctx.fill();

      // Draw text
      ctx.fillStyle = color;
      ctx.font = `bold ${scaledFont}px sans-serif`;
      ctx.textAlign = coords.align;
      ctx.textBaseline = coords.baseline;
      ctx.fillText(pageNumberText, coords.x, coords.y);
    };

    if (pageThumbnail) {
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0, W, H);
        drawPageNumber();
      };
      img.src = pageThumbnail;
    } else {
      // Placeholder lines
      ctx.strokeStyle = '#e5e7eb';
      ctx.lineWidth = 1;
      for (let y = 30; y < H - 20; y += 14) {
        const lineW = y < 50 ? W * 0.4 : W * (0.55 + Math.random() * 0.3);
        ctx.beginPath();
        ctx.moveTo(24, y);
        ctx.lineTo(Math.min(24 + lineW, W - 24), y);
        ctx.stroke();
      }
      drawPageNumber();
    }
  }, [pageThumbnail, position, format, startNumber, fontSize, color, margin, pageNumberText]);

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

      <ToolSuggestions analysis={analysis} currentToolId="page-numbers" />

      {/* Two-column layout: settings left, preview right */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">

        {/* LEFT COLUMN — Settings */}
        <div className="space-y-5">

          {/* Format */}
          <div className="space-y-2">
            <label htmlFor="num-format" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Number format
            </label>
            <select
              id="num-format"
              value={format}
              onChange={(e) => setFormat(e.target.value as NumberFormat)}
              className="w-48 px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none bg-white"
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
            <label htmlFor="start-number" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Starting number
            </label>
            <input
              id="start-number"
              type="number"
              min={1}
              value={startNumber}
              onChange={(e) => setStartNumber(Math.max(1, parseInt(e.target.value, 10) || 1))}
              className="w-24 px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
            />
          </div>

          {/* Font size slider */}
          <div className="space-y-2">
            <label htmlFor="font-size" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Font size: <span className="text-indigo-600 dark:text-indigo-400">{fontSize}pt</span>
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
            <div className="flex justify-between text-xs text-gray-400 dark:text-gray-500">
              <span>8pt</span>
              <span>36pt</span>
            </div>
          </div>

          {/* Color */}
          <div className="space-y-2">
            <label htmlFor="num-color" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Color
            </label>
            <div className="flex items-center gap-3">
              <input
                id="num-color"
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="w-10 h-10 rounded border border-gray-300 dark:border-gray-600 cursor-pointer"
              />
              <span className="text-sm text-gray-500 dark:text-gray-400 font-mono">{color}</span>
            </div>
          </div>

          {/* Margin slider */}
          <div className="space-y-2">
            <label htmlFor="margin" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Margin from edge: <span className="text-indigo-600 dark:text-indigo-400">{margin}pt</span>
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
            <div className="flex justify-between text-xs text-gray-400 dark:text-gray-500">
              <span>20pt</span>
              <span>100pt</span>
            </div>
          </div>

          {/* Apply to */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Apply to</label>
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
                <span className="text-sm text-gray-700 dark:text-gray-300">All pages</span>
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
            <Hash size={16} />
            {status === 'processing' ? 'Processing...' : 'Add Page Numbers'}
          </button>
        </div>

        {/* RIGHT COLUMN — Unified position picker + page preview */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Position &amp; Preview
            <span className="ml-2 text-xs font-normal text-gray-400 dark:text-gray-500">Click a zone to place the number &middot; {previewText}</span>
          </label>
          <div className="relative rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-4 shadow-inner">
            <div className="relative mx-auto overflow-hidden rounded-lg shadow-md" style={{ maxWidth: 400 }}>
              {/* Canvas draws page thumbnail + page number text */}
              <canvas
                ref={canvasRef}
                width={400}
                height={566}
                className="w-full h-auto block bg-white"
                data-testid="pagenumber-preview-canvas"
              />

              {/* 3x3 clickable zone grid overlaid on canvas */}
              <div className="absolute inset-2 grid grid-cols-3 grid-rows-3 gap-0">
                {POSITION_GRID.flat().map((cell) => {
                  const isSelected = position === cell.value;
                  return (
                    <button
                      key={cell.value}
                      onClick={() => setPosition(cell.value)}
                      className={`relative rounded transition-all duration-150 border cursor-pointer ${
                        isSelected
                          ? 'border-indigo-500 bg-indigo-500/10 border-2'
                          : 'border-gray-300/60 border-dashed hover:bg-indigo-500/5 hover:border-indigo-400/60'
                      }`}
                      title={positionLabel(cell.value)}
                      aria-label={`Place number at ${positionLabel(cell.value)}`}
                    >
                      {isSelected && (
                        <span className="absolute inset-0 flex items-center justify-center">
                          <span className="bg-indigo-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm">
                            {positionLabel(cell.value)}
                          </span>
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Page badge */}
              <div className="absolute bottom-2 right-2 bg-black/50 text-white text-[10px] px-2 py-0.5 rounded-full backdrop-blur-sm pointer-events-none">
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
