import { render, screen, fireEvent } from '@testing-library/react';
import { ToolSuggestions } from '@/components/common/ToolSuggestions';

const mockSetView = vi.fn();

vi.mock('@/stores/appStore', () => ({
  useAppStore: vi.fn((selector: (state: Record<string, unknown>) => unknown) => {
    const state = {
      setView: mockSetView,
      currentView: 'tool',
      currentToolId: null,
      pipelineMode: false,
      pipelineSelection: [],
    };
    return selector(state);
  }),
}));

vi.mock('pdfjs-dist', () => ({
  GlobalWorkerOptions: { workerSrc: '' },
  getDocument: vi.fn(),
}));

vi.mock('@/lib/pdf-worker-client', () => ({
  workerClient: {
    cancelAll: vi.fn(),
    process: vi.fn(),
  },
}));

vi.mock('@/lib/thumbnail-renderer', () => ({
  renderPageThumbnail: vi.fn(),
  getPageCount: vi.fn(),
  clearDocumentCache: vi.fn(),
}));

describe('ToolSuggestions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns null when analysis is null', () => {
    const { container } = render(<ToolSuggestions analysis={null} currentToolId="split" />);
    expect(container.innerHTML).toBe('');
  });

  it('returns null when no relevant suggestions apply', () => {
    const analysis = { isEncrypted: false, pageCount: 10, hasMixedPageSizes: false };
    const { container } = render(<ToolSuggestions analysis={analysis} currentToolId="rotate" />);
    expect(container.innerHTML).toBe('');
  });

  it('shows encrypted warning for password-protected PDFs', () => {
    const analysis = { isEncrypted: true, pageCount: 5, hasMixedPageSizes: false };
    render(<ToolSuggestions analysis={analysis} currentToolId="split" />);
    expect(screen.getByText(/password-protected/)).toBeInTheDocument();
  });

  it('does not show encrypted warning when on unlock tool', () => {
    const analysis = { isEncrypted: true, pageCount: 5, hasMixedPageSizes: false };
    const { container } = render(<ToolSuggestions analysis={analysis} currentToolId="unlock" />);
    expect(container.innerHTML).toBe('');
  });

  it('shows "Go to Unlock" action button for encrypted PDFs', () => {
    const analysis = { isEncrypted: true, pageCount: 5, hasMixedPageSizes: false };
    render(<ToolSuggestions analysis={analysis} currentToolId="rotate" />);
    expect(screen.getByText('Go to Unlock')).toBeInTheDocument();
  });

  it('calls setView with "tool" and "unlock" when Go to Unlock is clicked', () => {
    const analysis = { isEncrypted: true, pageCount: 5, hasMixedPageSizes: false };
    render(<ToolSuggestions analysis={analysis} currentToolId="rotate" />);
    fireEvent.click(screen.getByText('Go to Unlock'));
    expect(mockSetView).toHaveBeenCalledWith('tool', 'unlock');
  });

  it('shows large document suggestion for 50+ pages', () => {
    const analysis = { isEncrypted: false, pageCount: 75, hasMixedPageSizes: false };
    render(<ToolSuggestions analysis={analysis} currentToolId="rotate" />);
    expect(screen.getByText(/Large document.*75 pages/)).toBeInTheDocument();
  });

  it('does not show large document suggestion when on split tool', () => {
    const analysis = { isEncrypted: false, pageCount: 75, hasMixedPageSizes: false };
    const { container } = render(<ToolSuggestions analysis={analysis} currentToolId="split" />);
    expect(container.innerHTML).toBe('');
  });

  it('shows mixed page sizes suggestion', () => {
    const analysis = { isEncrypted: false, pageCount: 10, hasMixedPageSizes: true };
    render(<ToolSuggestions analysis={analysis} currentToolId="rotate" />);
    expect(screen.getByText(/mixed page sizes/)).toBeInTheDocument();
  });

  it('dismiss button hides the suggestion', () => {
    const analysis = { isEncrypted: true, pageCount: 5, hasMixedPageSizes: false };
    render(<ToolSuggestions analysis={analysis} currentToolId="split" />);
    expect(screen.getByText(/password-protected/)).toBeInTheDocument();

    const dismissButton = screen.getByLabelText('Dismiss');
    fireEvent.click(dismissButton);
    expect(screen.queryByText(/password-protected/)).not.toBeInTheDocument();
  });

  it('encrypted warning takes priority over large document suggestion', () => {
    const analysis = { isEncrypted: true, pageCount: 100, hasMixedPageSizes: true };
    render(<ToolSuggestions analysis={analysis} currentToolId="rotate" />);
    // Should show encrypted warning, not large document
    expect(screen.getByText(/password-protected/)).toBeInTheDocument();
    expect(screen.queryByText(/Large document/)).not.toBeInTheDocument();
  });
});
