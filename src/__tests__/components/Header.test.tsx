import { render, screen, fireEvent } from '@testing-library/react';
import { Header } from '@/components/layout/Header';
import { useAppStore } from '@/stores/appStore';
import { useProcessingStore } from '@/stores/processingStore';
import { useFileStore } from '@/stores/fileStore';
import { useThemeStore } from '@/stores/themeStore';

// Mock pdf-worker-client (imported transitively by tool components via constants)
vi.mock('@/lib/pdf-worker-client', () => ({
  workerClient: {
    cancelAll: vi.fn(),
    process: vi.fn(),
  },
}));

// Mock thumbnail-renderer (imported transitively by tool components)
vi.mock('@/lib/thumbnail-renderer', () => ({
  renderPageThumbnail: vi.fn(),
  getPageCount: vi.fn(),
  clearDocumentCache: vi.fn(),
}));

// Mock pdfjs-dist
vi.mock('pdfjs-dist', () => ({
  GlobalWorkerOptions: { workerSrc: '' },
  getDocument: vi.fn(),
}));

describe('Header', () => {
  beforeEach(() => {
    window.location.hash = '';
    useAppStore.setState({
      currentView: 'grid',
      currentToolId: null,
      pipelineMode: false,
      pipelineSelection: [],
    });
    useProcessingStore.setState({
      status: 'idle',
      progress: null,
      result: null,
      error: null,
      startTime: null,
    });
    useFileStore.setState({
      currentFiles: [],
      recentFiles: [],
    });
  });

  it('renders Quire heading', () => {
    render(<Header onShowShortcuts={() => {}} />);
    expect(screen.getByText('Quire')).toBeInTheDocument();
  });

  it('has keyboard shortcuts button with aria-label', () => {
    render(<Header onShowShortcuts={() => {}} />);
    expect(screen.getByLabelText('Keyboard shortcuts')).toBeInTheDocument();
  });

  it('calls onShowShortcuts when help button clicked', () => {
    const fn = vi.fn();
    render(<Header onShowShortcuts={fn} />);
    fireEvent.click(screen.getByLabelText('Keyboard shortcuts'));
    expect(fn).toHaveBeenCalledOnce();
  });

  it('renders all 7 category names', () => {
    render(<Header onShowShortcuts={() => {}} />);
    expect(screen.getByText('Organize')).toBeInTheDocument();
    expect(screen.getByText('Transform')).toBeInTheDocument();
    expect(screen.getByText('Stamp')).toBeInTheDocument();
    expect(screen.getByText('Security')).toBeInTheDocument();
    expect(screen.getByText('Info')).toBeInTheDocument();
    expect(screen.getByText('Edit')).toBeInTheDocument();
    expect(screen.getByText('Convert')).toBeInTheDocument();
  });

  it('renders tool names in dropdown menus', () => {
    render(<Header onShowShortcuts={() => {}} />);
    // Spot-check tools from different categories
    expect(screen.getByText('Split PDF')).toBeInTheDocument();
    expect(screen.getByText('Merge PDFs')).toBeInTheDocument();
    expect(screen.getByText('Rotate Pages')).toBeInTheDocument();
    expect(screen.getByText('Page Numbers')).toBeInTheDocument();
    expect(screen.getByText('Encrypt PDF')).toBeInTheDocument();
    expect(screen.getByText('Edit Metadata')).toBeInTheDocument();
  });

  it('renders tool descriptions in dropdowns', () => {
    render(<Header onShowShortcuts={() => {}} />);
    expect(screen.getByText('Split document into separate files')).toBeInTheDocument();
    expect(screen.getByText('Combine multiple PDFs into one')).toBeInTheDocument();
  });

  it('navigates to tool when clicked', () => {
    render(<Header onShowShortcuts={() => {}} />);
    fireEvent.click(screen.getByText('Split PDF'));
    const state = useAppStore.getState();
    expect(state.currentView).toBe('tool');
    expect(state.currentToolId).toBe('split');
  });

  it('navigates to different tools correctly', () => {
    render(<Header onShowShortcuts={() => {}} />);
    fireEvent.click(screen.getByText('Encrypt PDF'));
    expect(useAppStore.getState().currentToolId).toBe('encrypt');
  });

  it('shows confirm dialog when processing and user confirms', () => {
    useProcessingStore.setState({ status: 'processing' });
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);

    render(<Header onShowShortcuts={() => {}} />);
    fireEvent.click(screen.getByText('Rotate Pages'));

    expect(confirmSpy).toHaveBeenCalledWith('You have work in progress. Leave this page?');
    expect(useAppStore.getState().currentToolId).toBe('rotate');
    confirmSpy.mockRestore();
  });

  it('blocks navigation when processing and user cancels confirm', () => {
    useProcessingStore.setState({ status: 'processing' });
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);

    render(<Header onShowShortcuts={() => {}} />);
    fireEvent.click(screen.getByText('Rotate Pages'));

    expect(confirmSpy).toHaveBeenCalledWith('You have work in progress. Leave this page?');
    expect(useAppStore.getState().currentToolId).toBeNull();
    confirmSpy.mockRestore();
  });

  it('does not show confirm dialog when idle', () => {
    const confirmSpy = vi.spyOn(window, 'confirm');

    render(<Header onShowShortcuts={() => {}} />);
    fireEvent.click(screen.getByText('Split PDF'));

    expect(confirmSpy).not.toHaveBeenCalled();
    expect(useAppStore.getState().currentToolId).toBe('split');
    confirmSpy.mockRestore();
  });

  it('highlights active tool with indigo styling', () => {
    useAppStore.setState({ currentView: 'tool', currentToolId: 'split' });
    render(<Header onShowShortcuts={() => {}} />);
    const splitButton = screen.getByText('Split PDF').closest('button');
    expect(splitButton?.className).toContain('bg-indigo-50');
    expect(splitButton?.className).toContain('text-indigo-700');
  });

  it('does not highlight inactive tools', () => {
    useAppStore.setState({ currentView: 'tool', currentToolId: 'split' });
    render(<Header onShowShortcuts={() => {}} />);
    const mergeButton = screen.getByText('Merge PDFs').closest('button');
    expect(mergeButton?.className).not.toContain('bg-indigo-50');
  });

  it('category buttons have aria-haspopup', () => {
    render(<Header onShowShortcuts={() => {}} />);
    const categoryButtons = screen.getAllByRole('button', { expanded: undefined });
    const hasPopupButtons = categoryButtons.filter(
      (btn) => btn.getAttribute('aria-haspopup') === 'true'
    );
    expect(hasPopupButtons).toHaveLength(7);
  });

  it('renders all 15 tools across all categories', () => {
    render(<Header onShowShortcuts={() => {}} />);
    const expectedTools = [
      'Split PDF', 'Merge PDFs', 'Reorder Pages', 'Delete Pages',
      'Extract Pages', 'Add Blank Pages', 'Rotate Pages', 'Scale / Resize',
      'Page Numbers', 'Text Watermark', 'Encrypt PDF', 'Unlock PDF', 'Edit Metadata',
      'Edit PDF', 'Convert to PDF',
    ];
    for (const name of expectedTools) {
      expect(screen.getByText(name)).toBeInTheDocument();
    }
  });

  it('shows file-loaded warning when files are present and user confirms', () => {
    useFileStore.setState({
      currentFiles: [{
        id: '1', name: 'test.pdf', bytes: new Uint8Array([37, 80, 68, 70]),
        pageCount: 3, fileSize: 1000, isEncrypted: false,
      }],
    });
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);

    render(<Header onShowShortcuts={() => {}} />);
    fireEvent.click(screen.getByText('Split PDF'));

    expect(confirmSpy).toHaveBeenCalledWith('You have a file loaded. Leave this tool?');
    expect(useAppStore.getState().currentToolId).toBe('split');
    confirmSpy.mockRestore();
  });

  it('blocks navigation when files are present and user cancels', () => {
    useFileStore.setState({
      currentFiles: [{
        id: '1', name: 'test.pdf', bytes: new Uint8Array([37, 80, 68, 70]),
        pageCount: 3, fileSize: 1000, isEncrypted: false,
      }],
    });
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);

    render(<Header onShowShortcuts={() => {}} />);
    fireEvent.click(screen.getByText('Split PDF'));

    expect(confirmSpy).toHaveBeenCalledWith('You have a file loaded. Leave this tool?');
    expect(useAppStore.getState().currentToolId).toBeNull();
    confirmSpy.mockRestore();
  });

  it('processing warning takes priority over file-loaded warning', () => {
    useProcessingStore.setState({ status: 'processing' });
    useFileStore.setState({
      currentFiles: [{
        id: '1', name: 'test.pdf', bytes: new Uint8Array([37, 80, 68, 70]),
        pageCount: 3, fileSize: 1000, isEncrypted: false,
      }],
    });
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);

    render(<Header onShowShortcuts={() => {}} />);
    fireEvent.click(screen.getByText('Split PDF'));

    // Processing warning takes priority
    expect(confirmSpy).toHaveBeenCalledWith('You have work in progress. Leave this page?');
    confirmSpy.mockRestore();
  });

  it('renders theme toggle button', () => {
    render(<Header onShowShortcuts={() => {}} />);
    expect(screen.getByLabelText(/^Theme:/)).toBeInTheDocument();
  });

  it('cycles theme mode on click: system → light → dark → system', () => {
    useThemeStore.setState({ mode: 'system', resolved: 'light' });
    render(<Header onShowShortcuts={() => {}} />);

    const btn = screen.getByLabelText('Theme: system');
    fireEvent.click(btn);
    expect(useThemeStore.getState().mode).toBe('light');

    fireEvent.click(screen.getByLabelText('Theme: light'));
    expect(useThemeStore.getState().mode).toBe('dark');

    fireEvent.click(screen.getByLabelText('Theme: dark'));
    expect(useThemeStore.getState().mode).toBe('system');
  });

  it('theme toggle aria-label reflects current mode', () => {
    useThemeStore.setState({ mode: 'dark', resolved: 'dark' });
    render(<Header onShowShortcuts={() => {}} />);
    expect(screen.getByLabelText('Theme: dark')).toBeInTheDocument();
  });
});
