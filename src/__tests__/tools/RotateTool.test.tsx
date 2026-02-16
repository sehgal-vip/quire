import { render, screen, fireEvent } from '@testing-library/react';
import { RotateTool } from '@/components/tools/RotateTool';
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
vi.mock('@/components/common/ThumbnailGrid', () => ({
  ThumbnailGrid: ({
    pageCount,
    onPageClick,
    rotations,
  }: {
    pageCount: number;
    onPageClick?: (index: number) => void;
    rotations?: Record<number, number>;
  }) => (
    <div data-testid="thumbnail-grid">
      {Array.from({ length: pageCount }, (_, i) => (
        <button key={i} data-testid={`thumb-${i}`} onClick={() => onPageClick?.(i)}>
          Page {i + 1} {rotations?.[i] ? `(${rotations[i]}°)` : ''}
        </button>
      ))}
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

describe('RotateTool', () => {
  beforeEach(() => {
    useProcessingStore.getState().reset();
  });

  it('shows FileDropZone initially', () => {
    render(<RotateTool />);
    expect(screen.getByText('Drop your PDF')).toBeInTheDocument();
    expect(screen.getByTestId('file-drop-zone')).toBeInTheDocument();
  });

  it('shows bulk action buttons after file load', () => {
    render(<RotateTool />);
    fireEvent.click(screen.getByTestId('mock-load'));

    expect(screen.getByText(/Rotate All 90° CW/)).toBeInTheDocument();
    expect(screen.getByText(/Rotate All 90° CCW/)).toBeInTheDocument();
    expect(screen.getByText(/Rotate All 180°/)).toBeInTheDocument();
    expect(screen.getByText(/Rotate Even 90° CW/)).toBeInTheDocument();
    expect(screen.getByText(/Rotate Odd 90° CW/)).toBeInTheDocument();
  });

  it('Rotate Pages button is disabled when no rotations applied', () => {
    render(<RotateTool />);
    fireEvent.click(screen.getByTestId('mock-load'));

    const processButton = screen.getAllByRole('button', { name: /Rotate Pages/ })[0];
    expect(processButton).toBeDisabled();
  });

  it('clicking "Rotate All 90° CW" enables the process button', () => {
    render(<RotateTool />);
    fireEvent.click(screen.getByTestId('mock-load'));

    // Initially disabled
    expect(screen.getAllByRole('button', { name: /Rotate Pages/ })[0]).toBeDisabled();

    // Apply rotation
    fireEvent.click(screen.getByText(/Rotate All 90° CW/));

    // Now enabled
    expect(screen.getAllByRole('button', { name: /Rotate Pages/ })[0]).not.toBeDisabled();
  });

  it('"Reset all" button appears when rotations exist and clears them', () => {
    render(<RotateTool />);
    fireEvent.click(screen.getByTestId('mock-load'));

    // "Reset all" should NOT be visible initially
    expect(screen.queryByText(/Reset all/)).not.toBeInTheDocument();

    // Apply rotation
    fireEvent.click(screen.getByText(/Rotate All 90° CW/));

    // "Reset all" should now be visible
    expect(screen.getByText(/Reset all/)).toBeInTheDocument();

    // Click reset
    fireEvent.click(screen.getByText(/Reset all/));

    // Process button should be disabled again
    expect(screen.getAllByRole('button', { name: /Rotate Pages/ })[0]).toBeDisabled();

    // "Reset all" should disappear
    expect(screen.queryByText(/Reset all/)).not.toBeInTheDocument();
  });

  it('shows ThumbnailGrid after file load', () => {
    render(<RotateTool />);
    fireEvent.click(screen.getByTestId('mock-load'));

    expect(screen.getByTestId('thumbnail-grid')).toBeInTheDocument();
    // Should have 5 thumbnail buttons (one per page)
    for (let i = 0; i < 5; i++) {
      expect(screen.getByTestId(`thumb-${i}`)).toBeInTheDocument();
    }
  });

  it('shows rotation count text when rotations exist', () => {
    render(<RotateTool />);
    fireEvent.click(screen.getByTestId('mock-load'));

    // No rotation count initially
    expect(screen.queryByText(/page.*rotated/)).not.toBeInTheDocument();

    // Rotate all pages
    fireEvent.click(screen.getByText(/Rotate All 90° CW/));

    // Should show "5 pages rotated"
    expect(screen.getByText(/5 pages rotated/)).toBeInTheDocument();
  });

  it('clicking a thumbnail cycles rotation on that page', () => {
    render(<RotateTool />);
    fireEvent.click(screen.getByTestId('mock-load'));

    // Click on thumbnail for page 1
    fireEvent.click(screen.getByTestId('thumb-0'));

    // Should show 1 page rotated
    expect(screen.getByText(/1 page rotated/)).toBeInTheDocument();

    // Process button should be enabled
    expect(screen.getAllByRole('button', { name: /Rotate Pages/ })[0]).not.toBeDisabled();
  });

  it('hides tool UI when no file is loaded', () => {
    render(<RotateTool />);
    expect(screen.queryByText(/Rotate All 90° CW/)).not.toBeInTheDocument();
    expect(screen.queryByTestId('thumbnail-grid')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Rotate Pages/ })).not.toBeInTheDocument();
  });
});
