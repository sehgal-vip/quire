import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SplitTool } from '@/components/tools/SplitTool';
import { useProcessingStore } from '@/stores/processingStore';

// Common mocks
vi.mock('@/lib/pdf-worker-client', () => ({
  workerClient: {
    cancelAll: vi.fn(),
    process: vi.fn().mockResolvedValue({
      files: [{ name: 'output.pdf', bytes: new Uint8Array([37, 80, 68, 70]), pageCount: 5 }],
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
  FileDropZone: ({ onFilesLoaded }: { onFilesLoaded: (files: any[]) => void }) => (
    <div data-testid="file-drop-zone">
      <span>Drop your PDF</span>
      <button
        data-testid="mock-load"
        onClick={() =>
          onFilesLoaded([
            {
              id: 'test-1',
              name: 'test.pdf',
              bytes: new Uint8Array([37, 80, 68, 70]),
              pageCount: 5,
              fileSize: 1024,
              isEncrypted: false,
            },
          ])
        }
      >
        Load File
      </button>
    </div>
  ),
}));
vi.mock('@/components/common/PageSelector', () => ({
  PageSelector: ({
    pageCount,
    selectedPages,
    onSelectionChange,
  }: {
    pageCount: number;
    selectedPages: Set<number>;
    onSelectionChange: (s: Set<number>) => void;
  }) => (
    <div data-testid="page-selector">
      <span>Pages: {pageCount}</span>
      <button
        data-testid="select-page-0"
        onClick={() => {
          const next = new Set(selectedPages);
          next.add(0);
          onSelectionChange(next);
        }}
      >
        Select Page 1
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

describe('SplitTool', () => {
  beforeEach(() => {
    useProcessingStore.getState().reset();
  });

  it('shows FileDropZone initially', () => {
    render(<SplitTool />);
    expect(screen.getByText('Drop your PDF')).toBeInTheDocument();
    expect(screen.getByTestId('file-drop-zone')).toBeInTheDocument();
  });

  it('shows split mode toggle buttons after file load', () => {
    render(<SplitTool />);
    fireEvent.click(screen.getByTestId('mock-load'));

    expect(screen.getByText('Extract pages')).toBeInTheDocument();
    expect(screen.getByText('Split into ranges')).toBeInTheDocument();
  });

  it('Split PDF button is disabled when no pages selected', () => {
    render(<SplitTool />);
    fireEvent.click(screen.getByTestId('mock-load'));

    const processButton = screen.getAllByRole('button', { name: /Split PDF/ })[0];
    expect(processButton).toBeDisabled();
  });

  it('shows PageSelector in single mode', () => {
    render(<SplitTool />);
    fireEvent.click(screen.getByTestId('mock-load'));

    expect(screen.getByTestId('page-selector')).toBeInTheDocument();
    expect(screen.getByText('Pages: 5')).toBeInTheDocument();
  });

  it('shows range input in separate mode', () => {
    render(<SplitTool />);
    fireEvent.click(screen.getByTestId('mock-load'));

    // Switch to separate mode
    fireEvent.click(screen.getByText('Split into ranges'));

    expect(screen.getByLabelText(/Page ranges/)).toBeInTheDocument();
    expect(screen.getByPlaceholderText('e.g., 1-3, 4-7, 8-end')).toBeInTheDocument();
    // PageSelector should NOT be visible in separate mode
    expect(screen.queryByTestId('page-selector')).not.toBeInTheDocument();
  });

  it('process button text changes based on processing status', async () => {
    const { act } = await import('react');

    render(<SplitTool />);
    fireEvent.click(screen.getByTestId('mock-load'));

    // Default idle state
    expect(screen.getAllByRole('button', { name: /Split PDF/ })[0]).toBeInTheDocument();

    // Simulate processing state via store update inside act
    act(() => {
      useProcessingStore.getState().startProcessing();
    });

    expect(screen.getAllByRole('button', { name: /Processing/ })[0]).toBeInTheDocument();
  });

  it('enables Split PDF button after selecting a page', () => {
    render(<SplitTool />);
    fireEvent.click(screen.getByTestId('mock-load'));

    // Initially disabled
    expect(screen.getAllByRole('button', { name: /Split PDF/ })[0]).toBeDisabled();

    // Select a page
    fireEvent.click(screen.getByTestId('select-page-0'));

    // Now enabled
    expect(screen.getAllByRole('button', { name: /Split PDF/ })[0]).not.toBeDisabled();
  });

  it('hides tool UI when no file is loaded', () => {
    render(<SplitTool />);
    expect(screen.queryByText('Extract pages')).not.toBeInTheDocument();
    expect(screen.queryByText('Split into ranges')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Split PDF/ })).not.toBeInTheDocument();
  });
});
