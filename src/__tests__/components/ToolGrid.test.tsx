import { render, screen, fireEvent } from '@testing-library/react';
import { ToolGrid } from '@/components/common/ToolGrid';
import { useAppStore } from '@/stores/appStore';
import { usePipelineStore } from '@/stores/pipelineStore';

// Mock pdf-worker-client (imported transitively by tool components)
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

describe('ToolGrid', () => {
  beforeEach(() => {
    window.location.hash = '';
    useAppStore.setState({
      currentView: 'grid',
      currentToolId: null,
      pipelineMode: false,
      pipelineSelection: [],
    });
    usePipelineStore.getState().clearPipeline();
  });

  it('U-LY-03: renders all 13 tool cards', () => {
    render(<ToolGrid />);
    // Check for all tool names
    expect(screen.getByText('Split PDF')).toBeInTheDocument();
    expect(screen.getByText('Merge PDFs')).toBeInTheDocument();
    expect(screen.getByText('Rotate Pages')).toBeInTheDocument();
    expect(screen.getByText('Reorder Pages')).toBeInTheDocument();
    expect(screen.getByText('Delete Pages')).toBeInTheDocument();
    expect(screen.getByText('Extract Pages')).toBeInTheDocument();
    expect(screen.getByText('Add Blank Pages')).toBeInTheDocument();
    expect(screen.getByText('Scale / Resize')).toBeInTheDocument();
    expect(screen.getByText('Page Numbers')).toBeInTheDocument();
    expect(screen.getByText('Text Watermark')).toBeInTheDocument();
    expect(screen.getByText('Encrypt PDF')).toBeInTheDocument();
    expect(screen.getByText('Unlock PDF')).toBeInTheDocument();
    expect(screen.getByText('Edit Metadata')).toBeInTheDocument();
  });

  it('U-LY-04: renders category headers', () => {
    render(<ToolGrid />);
    expect(screen.getByText('Organize')).toBeInTheDocument();
    expect(screen.getByText('Transform')).toBeInTheDocument();
    expect(screen.getByText('Stamp')).toBeInTheDocument();
    expect(screen.getByText('Security')).toBeInTheDocument();
    expect(screen.getByText('Info')).toBeInTheDocument();
  });

  it('has mode toggle buttons', () => {
    render(<ToolGrid />);
    expect(screen.getByText('Single Tool')).toBeInTheDocument();
    expect(screen.getByText('Pipeline')).toBeInTheDocument();
  });

  it('U-TC-02: clicking a tool in single mode navigates', () => {
    render(<ToolGrid />);
    fireEvent.click(screen.getByText('Split PDF'));
    const state = useAppStore.getState();
    expect(state.currentView).toBe('tool');
    expect(state.currentToolId).toBe('split');
  });

  it('pipeline mode toggle works', () => {
    render(<ToolGrid />);
    fireEvent.click(screen.getByText('Pipeline'));
    expect(useAppStore.getState().pipelineMode).toBe(true);
  });

  it('U-TC-04: merge is disabled in pipeline mode', () => {
    useAppStore.setState({ pipelineMode: true });
    render(<ToolGrid />);
    const mergeButton = screen.getByLabelText('Merge PDFs (not available in pipeline)');
    expect(mergeButton).toBeDisabled();
  });

  it('U-TC-03: pipeline badges show numbers', () => {
    useAppStore.setState({ pipelineMode: true });
    usePipelineStore.getState().addTool('rotate');
    usePipelineStore.getState().addTool('scale');
    render(<ToolGrid />);
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('pipeline selection summary shows tool count', () => {
    useAppStore.setState({ pipelineMode: true });
    usePipelineStore.getState().addTool('rotate');
    usePipelineStore.getState().addTool('scale');
    render(<ToolGrid />);
    expect(screen.getByText('2 tools selected')).toBeInTheDocument();
  });

  it('F-PL-09: Start Pipeline disabled with <2 tools', () => {
    useAppStore.setState({ pipelineMode: true });
    usePipelineStore.getState().addTool('rotate');
    render(<ToolGrid />);
    const startBtn = screen.getByText('Start Pipeline');
    expect(startBtn).toBeDisabled();
  });
});
