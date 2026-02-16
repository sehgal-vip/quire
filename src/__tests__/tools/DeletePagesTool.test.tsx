import { render, screen, fireEvent } from '@testing-library/react';
import { DeletePagesTool } from '@/components/tools/DeletePagesTool';
import { useProcessingStore } from '@/stores/processingStore';
import { ERRORS } from '@/lib/error-messages';

// Common mocks
vi.mock('@/lib/pdf-worker-client', () => ({
  workerClient: {
    cancelAll: vi.fn(),
    process: vi.fn().mockResolvedValue({
      files: [{ name: 'output.pdf', bytes: new Uint8Array([37, 80, 68, 70]), pageCount: 4 }],
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
    overlayType,
  }: {
    pageCount: number;
    selectedPages: Set<number>;
    onSelectionChange: (s: Set<number>) => void;
    overlayType: string;
  }) => (
    <div data-testid="page-selector" data-overlay={overlayType}>
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
      <button
        data-testid="select-all-pages"
        onClick={() => {
          const all = new Set<number>();
          for (let i = 0; i < pageCount; i++) all.add(i);
          onSelectionChange(all);
        }}
      >
        Select All
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

describe('DeletePagesTool', () => {
  beforeEach(() => {
    useProcessingStore.getState().reset();
  });

  it('shows FileDropZone initially', () => {
    render(<DeletePagesTool />);
    expect(screen.getByText('Drop your PDF')).toBeInTheDocument();
    expect(screen.getByTestId('file-drop-zone')).toBeInTheDocument();
  });

  it('shows page selector with delete overlay after file load', () => {
    render(<DeletePagesTool />);
    fireEvent.click(screen.getByTestId('mock-load'));

    const pageSelector = screen.getByTestId('page-selector');
    expect(pageSelector).toBeInTheDocument();
    expect(pageSelector.getAttribute('data-overlay')).toBe('delete');
  });

  it('delete button is disabled with no selection', () => {
    render(<DeletePagesTool />);
    fireEvent.click(screen.getByTestId('mock-load'));

    // Button text should say "Select pages to delete" when none selected
    const processButton = screen.getAllByRole('button', { name: /Select pages/ })[0];
    expect(processButton).toBeDisabled();
  });

  it('delete button is enabled when some pages are selected', () => {
    render(<DeletePagesTool />);
    fireEvent.click(screen.getByTestId('mock-load'));

    // Select one page
    fireEvent.click(screen.getByTestId('select-page-0'));

    const processButton = screen.getAllByRole('button', { name: /Delete 1 Page/ })[0];
    expect(processButton).not.toBeDisabled();
  });

  it('delete button is disabled when ALL pages are selected', () => {
    render(<DeletePagesTool />);
    fireEvent.click(screen.getByTestId('mock-load'));

    // Select all pages
    fireEvent.click(screen.getByTestId('select-all-pages'));

    // Button should be disabled when all pages selected
    const processButton = screen.getAllByRole('button', { name: /Delete 5 Pages/ })[0];
    expect(processButton).toBeDisabled();
  });

  it('shows CANNOT_DELETE_ALL warning when all pages selected', () => {
    render(<DeletePagesTool />);
    fireEvent.click(screen.getByTestId('mock-load'));

    // Select all pages
    fireEvent.click(screen.getByTestId('select-all-pages'));

    expect(screen.getByText(ERRORS.CANNOT_DELETE_ALL)).toBeInTheDocument();
  });

  it('shows deletion count text when pages are selected', () => {
    render(<DeletePagesTool />);
    fireEvent.click(screen.getByTestId('mock-load'));

    // Select one page
    fireEvent.click(screen.getByTestId('select-page-0'));

    // Shows "Delete 1 of 5 pages?" - use specific class-based selectors
    const countSpan = screen.getByText((content, element) => {
      return element?.className?.includes('font-semibold') && element?.className?.includes('text-red-600') && content === '1';
    });
    expect(countSpan).toBeInTheDocument();

    const totalSpan = screen.getByText((content, element) => {
      return element?.className === 'font-semibold' && content === '5';
    });
    expect(totalSpan).toBeInTheDocument();
  });

  it('hides tool UI when no file is loaded', () => {
    render(<DeletePagesTool />);
    expect(screen.queryByTestId('page-selector')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Delete/ })).not.toBeInTheDocument();
  });
});
