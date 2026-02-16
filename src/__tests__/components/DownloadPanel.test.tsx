import { render, screen, fireEvent } from '@testing-library/react';
import { DownloadPanel } from '@/components/common/DownloadPanel';
import { downloadFile, downloadAsZip } from '@/lib/download-utils';
import type { ToolOutput, OutputFile } from '@/types';

vi.mock('@/lib/download-utils', () => ({
  downloadFile: vi.fn(),
  downloadAsZip: vi.fn(),
  formatFileSize: vi.fn((n: number) => `${n} B`),
}));

function makeFile(name: string, size = 100, pageCount = 1): OutputFile {
  return { name, bytes: new Uint8Array(size), pageCount };
}

function makeResult(files: OutputFile[], processingTime = 500): ToolOutput {
  return { files, processingTime };
}

describe('DownloadPanel', () => {
  const onReset = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows "Download" button for single file result', () => {
    const result = makeResult([makeFile('output.pdf')]);
    render(<DownloadPanel result={result} onReset={onReset} />);
    expect(screen.getByText('Download')).toBeInTheDocument();
  });

  it('does not show ZIP button for single file result', () => {
    const result = makeResult([makeFile('output.pdf')]);
    render(<DownloadPanel result={result} onReset={onReset} />);
    expect(screen.queryByText('Download All as ZIP')).not.toBeInTheDocument();
  });

  it('calls downloadFile when single file Download button is clicked', () => {
    const file = makeFile('output.pdf');
    const result = makeResult([file]);
    render(<DownloadPanel result={result} onReset={onReset} />);
    fireEvent.click(screen.getByText('Download'));
    expect(downloadFile).toHaveBeenCalledWith(file);
  });

  it('shows "Download All as ZIP" button for multiple files', () => {
    const result = makeResult([makeFile('part1.pdf'), makeFile('part2.pdf')]);
    render(<DownloadPanel result={result} onReset={onReset} />);
    expect(screen.getByText('Download All as ZIP')).toBeInTheDocument();
  });

  it('calls downloadAsZip when ZIP button is clicked', () => {
    const files = [makeFile('part1.pdf'), makeFile('part2.pdf')];
    const result = makeResult(files);
    render(<DownloadPanel result={result} onReset={onReset} />);
    fireEvent.click(screen.getByText('Download All as ZIP'));
    expect(downloadAsZip).toHaveBeenCalledWith(files, 'quire-output.zip');
  });

  it('shows individual file download buttons for multiple files', () => {
    const result = makeResult([makeFile('part1.pdf'), makeFile('part2.pdf'), makeFile('part3.pdf')]);
    render(<DownloadPanel result={result} onReset={onReset} />);
    expect(screen.getByText('part1.pdf')).toBeInTheDocument();
    expect(screen.getByText('part2.pdf')).toBeInTheDocument();
    expect(screen.getByText('part3.pdf')).toBeInTheDocument();
  });

  it('calls downloadFile when individual file button is clicked', () => {
    const files = [makeFile('part1.pdf'), makeFile('part2.pdf')];
    const result = makeResult(files);
    render(<DownloadPanel result={result} onReset={onReset} />);
    fireEvent.click(screen.getByText('part1.pdf'));
    expect(downloadFile).toHaveBeenCalledWith(files[0]);
  });

  it('shows "Process another file" button', () => {
    const result = makeResult([makeFile('output.pdf')]);
    render(<DownloadPanel result={result} onReset={onReset} />);
    expect(screen.getByText('Process another file')).toBeInTheDocument();
  });

  it('calls onReset when "Process another file" button is clicked', () => {
    const result = makeResult([makeFile('output.pdf')]);
    render(<DownloadPanel result={result} onReset={onReset} />);
    fireEvent.click(screen.getByText('Process another file'));
    expect(onReset).toHaveBeenCalledOnce();
  });

  it('does not show single Download button for multiple files', () => {
    const result = makeResult([makeFile('a.pdf'), makeFile('b.pdf')]);
    render(<DownloadPanel result={result} onReset={onReset} />);
    // The "Download" text only appears as "Download All as ZIP", not standalone
    const buttons = screen.getAllByRole('button');
    const downloadButtons = buttons.filter((b) => b.textContent?.trim() === 'Download');
    expect(downloadButtons).toHaveLength(0);
  });
});
