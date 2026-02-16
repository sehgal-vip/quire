import { render, screen, fireEvent } from '@testing-library/react';
import { MergeTool } from '@/components/tools/MergeTool';
import { useProcessingStore } from '@/stores/processingStore';

// Common mocks
vi.mock('@/lib/pdf-worker-client', () => ({
  workerClient: {
    cancelAll: vi.fn(),
    process: vi.fn().mockResolvedValue({
      files: [{ name: 'output.pdf', bytes: new Uint8Array([37, 80, 68, 70]), pageCount: 8 }],
      processingTime: 100,
    }),
  },
}));
vi.mock('@/lib/thumbnail-renderer', () => ({
  renderPageThumbnail: vi.fn().mockResolvedValue('data:image/jpeg;base64,mock'),
  getPageCount: vi.fn().mockResolvedValue(5),
  clearDocumentCache: vi.fn(),
}));
vi.mock('@/lib/render-queue', () => ({
  renderQueue: {
    enqueue: vi.fn().mockResolvedValue('data:image/jpeg;base64,mock'),
    cancel: vi.fn(),
    cancelAll: vi.fn(),
  },
}));
vi.mock('pdfjs-dist', () => ({
  GlobalWorkerOptions: { workerSrc: '' },
  getDocument: vi.fn(),
}));
vi.mock('react-hot-toast', () => ({
  default: { error: vi.fn(), success: vi.fn() },
}));

// Mock dependent components
vi.mock('@/components/common/FileDropZone', () => ({
  FileDropZone: ({
    onFilesLoaded,
    multiple,
  }: {
    onFilesLoaded: (files: any[]) => void;
    multiple?: boolean;
  }) => (
    <div data-testid="file-drop-zone" data-multiple={multiple}>
      <span>Drop your PDF</span>
      <button
        data-testid="mock-load-multi"
        onClick={() =>
          onFilesLoaded([
            {
              id: 'f1',
              name: 'file1.pdf',
              bytes: new Uint8Array([37, 80, 68, 70]),
              pageCount: 3,
              fileSize: 1024,
              isEncrypted: false,
            },
            {
              id: 'f2',
              name: 'file2.pdf',
              bytes: new Uint8Array([37, 80, 68, 70]),
              pageCount: 5,
              fileSize: 2048,
              isEncrypted: false,
            },
          ])
        }
      >
        Load Files
      </button>
      <button
        data-testid="mock-load-single"
        onClick={() =>
          onFilesLoaded([
            {
              id: 'f1',
              name: 'file1.pdf',
              bytes: new Uint8Array([37, 80, 68, 70]),
              pageCount: 3,
              fileSize: 1024,
              isEncrypted: false,
            },
          ])
        }
      >
        Load One File
      </button>
    </div>
  ),
}));
vi.mock('@/components/common/ProgressBar', () => ({
  ProgressBar: () => <div data-testid="progress-bar" />,
}));
vi.mock('@/components/common/PreviewPanel', () => ({
  PreviewPanel: () => <div data-testid="preview-panel" />,
}));
vi.mock('@/components/common/DownloadPanel', () => ({
  DownloadPanel: ({ onReset }: { onReset: () => void }) => (
    <div data-testid="download-panel">
      <button onClick={onReset}>Reset</button>
    </div>
  ),
}));
vi.mock('@/components/common/ToolSuggestions', () => ({
  ToolSuggestions: () => null,
}));

describe('MergeTool', () => {
  beforeEach(() => {
    useProcessingStore.getState().reset();
  });

  it('shows FileDropZone initially with multiple support', () => {
    render(<MergeTool />);
    expect(screen.getByText('Drop your PDF')).toBeInTheDocument();
    const dropZone = screen.getByTestId('file-drop-zone');
    expect(dropZone).toBeInTheDocument();
    expect(dropZone.getAttribute('data-multiple')).toBe('true');
  });

  it('shows file list after files loaded', () => {
    render(<MergeTool />);
    fireEvent.click(screen.getByTestId('mock-load-multi'));

    expect(screen.getByText('file1.pdf')).toBeInTheDocument();
    expect(screen.getByText('file2.pdf')).toBeInTheDocument();
  });

  it('Merge PDFs button disabled with less than 2 files', () => {
    render(<MergeTool />);
    fireEvent.click(screen.getByTestId('mock-load-single'));

    const processButton = screen.getAllByRole('button', { name: /Merge PDFs/ })[0];
    expect(processButton).toBeDisabled();
  });

  it('Merge PDFs button enabled with 2 or more files', () => {
    render(<MergeTool />);
    fireEvent.click(screen.getByTestId('mock-load-multi'));

    const processButton = screen.getAllByRole('button', { name: /Merge PDFs/ })[0];
    expect(processButton).not.toBeDisabled();
  });

  it('shows file count and total page count', () => {
    render(<MergeTool />);
    fireEvent.click(screen.getByTestId('mock-load-multi'));

    // File count header: "File order (2 files)"
    expect(screen.getAllByText(/2 files/).length).toBeGreaterThanOrEqual(1);
    // Total page count: "Total: 8 pages"
    expect(screen.getByText(/Total: 8 pages/)).toBeInTheDocument();
  });

  it('first file move-up button is disabled, last file move-down button is disabled', () => {
    render(<MergeTool />);
    fireEvent.click(screen.getByTestId('mock-load-multi'));

    const moveUpFile1 = screen.getByRole('button', { name: 'Move file1.pdf up' });
    const moveDownFile2 = screen.getByRole('button', { name: 'Move file2.pdf down' });

    expect(moveUpFile1).toBeDisabled();
    expect(moveDownFile2).toBeDisabled();
  });

  it('move-down on first file reorders the list', () => {
    render(<MergeTool />);
    fireEvent.click(screen.getByTestId('mock-load-multi'));

    // Initially: file1.pdf, file2.pdf
    const moveDownFile1 = screen.getByRole('button', { name: 'Move file1.pdf down' });
    fireEvent.click(moveDownFile1);

    // After move: file2.pdf should come first
    const fileNames = screen.getAllByText(/\.pdf$/);
    expect(fileNames[0]).toHaveTextContent('file2.pdf');
    expect(fileNames[1]).toHaveTextContent('file1.pdf');
  });

  it('remove button removes file from list', () => {
    render(<MergeTool />);
    fireEvent.click(screen.getByTestId('mock-load-multi'));

    expect(screen.getByText('file1.pdf')).toBeInTheDocument();
    expect(screen.getByText('file2.pdf')).toBeInTheDocument();

    // Remove file1
    const removeFile1 = screen.getByRole('button', { name: 'Remove file1.pdf' });
    fireEvent.click(removeFile1);

    expect(screen.queryByText('file1.pdf')).not.toBeInTheDocument();
    expect(screen.getByText('file2.pdf')).toBeInTheDocument();
  });

  it('removing a file so only 1 remains disables Merge PDFs button', () => {
    render(<MergeTool />);
    fireEvent.click(screen.getByTestId('mock-load-multi'));

    // Initially enabled
    expect(screen.getAllByRole('button', { name: /Merge PDFs/ })[0]).not.toBeDisabled();

    // Remove one file
    const removeFile1 = screen.getByRole('button', { name: 'Remove file1.pdf' });
    fireEvent.click(removeFile1);

    // Now disabled
    expect(screen.getAllByRole('button', { name: /Merge PDFs/ })[0]).toBeDisabled();
  });

  it('hides file list UI when no files loaded', () => {
    render(<MergeTool />);
    expect(screen.queryByText(/File order/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Merge PDFs/ })).not.toBeInTheDocument();
  });
});
