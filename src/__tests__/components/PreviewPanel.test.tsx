import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { PreviewPanel } from '@/components/common/PreviewPanel';
import type { ToolOutput, OutputFile } from '@/types';

// Mock IntersectionObserver
class MockIntersectionObserver {
  callback: IntersectionObserverCallback;
  constructor(callback: IntersectionObserverCallback) {
    this.callback = callback;
  }
  observe(el: Element) {
    this.callback(
      [{ target: el, isIntersecting: true } as IntersectionObserverEntry],
      this as unknown as IntersectionObserver,
    );
  }
  disconnect() {}
  unobserve() {}
  takeRecords() { return []; }
  get root() { return null; }
  get rootMargin() { return ''; }
  get thresholds() { return [0]; }
}

beforeAll(() => {
  global.IntersectionObserver = MockIntersectionObserver as unknown as typeof IntersectionObserver;
});

vi.mock('@/lib/thumbnail-renderer', () => ({
  renderPageThumbnail: vi.fn().mockResolvedValue(null),
  getPageCount: vi.fn(),
  clearDocumentCache: vi.fn(),
}));

vi.mock('@/lib/download-utils', () => ({
  formatFileSize: vi.fn((n: number) => `${n} B`),
  downloadFile: vi.fn(),
  downloadAsZip: vi.fn(),
}));

vi.mock('@/lib/time-estimator', () => ({
  formatDuration: vi.fn((ms: number) => `${ms}ms`),
  estimateTime: vi.fn(),
  formatTime: vi.fn(),
}));

function makeFile(name: string, size = 1024, pageCount = 5): OutputFile {
  return { name, bytes: new Uint8Array(size), pageCount };
}

function makeResult(files: OutputFile[], processingTime = 1200): ToolOutput {
  return { files, processingTime };
}

describe('PreviewPanel', () => {
  it('shows file name for single file result', () => {
    const result = makeResult([makeFile('report.pdf')]);
    render(<PreviewPanel result={result} />);
    expect(screen.getByText('report.pdf')).toBeInTheDocument();
  });

  it('shows page count and file size for single file', () => {
    const result = makeResult([makeFile('report.pdf', 2048, 12)]);
    render(<PreviewPanel result={result} />);
    // formatFileSize is mocked to return "2048 B"
    expect(screen.getByText('12 pages · 2048 B')).toBeInTheDocument();
  });

  it('shows "N files" for multiple file result', () => {
    const result = makeResult([
      makeFile('part1.pdf', 500, 3),
      makeFile('part2.pdf', 600, 4),
      makeFile('part3.pdf', 700, 5),
    ]);
    render(<PreviewPanel result={result} />);
    expect(screen.getByText('3 files')).toBeInTheDocument();
  });

  it('shows total file size for multiple files', () => {
    const result = makeResult([
      makeFile('a.pdf', 500, 2),
      makeFile('b.pdf', 300, 3),
    ]);
    render(<PreviewPanel result={result} />);
    // Total = 500 + 300 = 800, formatFileSize mock returns "800 B"
    expect(screen.getByText('Total: 800 B')).toBeInTheDocument();
  });

  it('shows processing time', () => {
    const result = makeResult([makeFile('output.pdf')], 1500);
    render(<PreviewPanel result={result} />);
    // formatDuration is mocked to return "1500ms"
    expect(screen.getByText('Completed in 1500ms')).toBeInTheDocument();
  });

  it('shows original toggle button when showOriginalToggle=true and originalBytes provided', () => {
    const result = makeResult([makeFile('output.pdf')]);
    const originalBytes = new Uint8Array(2048);
    render(<PreviewPanel result={result} originalBytes={originalBytes} showOriginalToggle />);
    expect(screen.getByText('Show original')).toBeInTheDocument();
  });

  it('does not show original toggle when showOriginalToggle is false', () => {
    const result = makeResult([makeFile('output.pdf')]);
    const originalBytes = new Uint8Array(2048);
    render(<PreviewPanel result={result} originalBytes={originalBytes} showOriginalToggle={false} />);
    expect(screen.queryByText('Show original')).not.toBeInTheDocument();
  });

  it('does not show original toggle when originalBytes not provided', () => {
    const result = makeResult([makeFile('output.pdf')]);
    render(<PreviewPanel result={result} showOriginalToggle />);
    expect(screen.queryByText('Show original')).not.toBeInTheDocument();
  });

  it('toggles between "Show original" and "Show processed" on click', () => {
    const result = makeResult([makeFile('output.pdf')]);
    const originalBytes = new Uint8Array(2048);
    render(<PreviewPanel result={result} originalBytes={originalBytes} showOriginalToggle />);

    const toggleButton = screen.getByText('Show original');
    fireEvent.click(toggleButton);
    expect(screen.getByText('Show processed')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Show processed'));
    expect(screen.getByText('Show original')).toBeInTheDocument();
  });

  it('shows file tabs for multiple file results', () => {
    const result = makeResult([
      makeFile('chapter1.pdf', 400, 10),
      makeFile('chapter2.pdf', 600, 15),
    ]);
    render(<PreviewPanel result={result} />);
    // File names appear as tab buttons
    expect(screen.getByText('chapter1.pdf')).toBeInTheDocument();
    expect(screen.getByText('chapter2.pdf')).toBeInTheDocument();
  });

  it('shows size reduction info when output is smaller than original', () => {
    const result = makeResult([makeFile('compressed.pdf', 500, 5)]);
    const originalBytes = new Uint8Array(1000);
    render(<PreviewPanel result={result} originalBytes={originalBytes} />);
    // sizeDiff = ((500 - 1000) / 1000) * 100 = -50, so "50% smaller"
    expect(screen.getByText(/50% smaller/)).toBeInTheDocument();
  });
});
