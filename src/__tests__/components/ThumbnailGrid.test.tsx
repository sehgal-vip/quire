import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ThumbnailGrid } from '@/components/common/ThumbnailGrid';

vi.mock('@/lib/thumbnail-renderer', () => ({
  renderPageThumbnail: vi.fn().mockResolvedValue('data:image/jpeg;base64,mock'),
  getPageCount: vi.fn(),
  clearDocumentCache: vi.fn(),
}));

vi.mock('@/lib/render-queue', () => ({
  renderQueue: {
    enqueue: vi.fn().mockResolvedValue('data:image/jpeg;base64,mock'),
    cancel: vi.fn(),
    cancelAll: vi.fn(),
  },
}));

// Mock IntersectionObserver since jsdom does not support it
beforeEach(() => {
  vi.clearAllMocks();

  class MockIntersectionObserver {
    callback: IntersectionObserverCallback;
    constructor(callback: IntersectionObserverCallback) {
      this.callback = callback;
    }
    observe(el: Element) {
      // Simulate the element being in view immediately
      this.callback(
        [{ target: el, isIntersecting: true } as IntersectionObserverEntry],
        this as unknown as IntersectionObserver,
      );
    }
    unobserve() {}
    disconnect() {}
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).IntersectionObserver = MockIntersectionObserver;
});

const mockPdfBytes = new Uint8Array([37, 80, 68, 70]); // %PDF

describe('ThumbnailGrid', () => {
  it('renders correct number of grid cells based on pageCount', () => {
    render(<ThumbnailGrid pdfBytes={mockPdfBytes} pageCount={5} />);
    const cells = screen.getAllByRole('gridcell');
    expect(cells).toHaveLength(5);
  });

  it('each cell has role="gridcell" and data-page attribute', () => {
    render(<ThumbnailGrid pdfBytes={mockPdfBytes} pageCount={3} />);
    const cells = screen.getAllByRole('gridcell');
    cells.forEach((cell, i) => {
      expect(cell).toHaveAttribute('data-page', String(i));
    });
  });

  it('grid container has role="grid"', () => {
    render(<ThumbnailGrid pdfBytes={mockPdfBytes} pageCount={2} />);
    expect(screen.getByRole('grid')).toBeInTheDocument();
  });

  it('shows 1-indexed page numbers in cells', () => {
    render(<ThumbnailGrid pdfBytes={mockPdfBytes} pageCount={4} />);
    // Each cell shows the page number in the bottom badge (1-indexed)
    expect(screen.getAllByText('1').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('2').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('3').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('4').length).toBeGreaterThanOrEqual(1);
  });

  it('clicking a cell calls onPageClick with correct 0-indexed page', () => {
    const onPageClick = vi.fn();
    render(<ThumbnailGrid pdfBytes={mockPdfBytes} pageCount={3} onPageClick={onPageClick} />);
    const cells = screen.getAllByRole('gridcell');
    fireEvent.click(cells[2]);
    expect(onPageClick).toHaveBeenCalledWith(2);
  });

  it('selected pages show indigo border with overlayType="selected"', () => {
    const selected = new Set([0, 2]);
    render(
      <ThumbnailGrid
        pdfBytes={mockPdfBytes}
        pageCount={3}
        selectedPages={selected}
        overlayType="selected"
      />,
    );
    const cells = screen.getAllByRole('gridcell');
    expect(cells[0].className).toContain('border-indigo-500');
    expect(cells[1].className).not.toContain('border-indigo-500');
    expect(cells[2].className).toContain('border-indigo-500');
  });

  it('delete overlay shows red border with overlayType="delete"', () => {
    const selected = new Set([1]);
    render(
      <ThumbnailGrid
        pdfBytes={mockPdfBytes}
        pageCount={3}
        selectedPages={selected}
        overlayType="delete"
      />,
    );
    const cells = screen.getAllByRole('gridcell');
    expect(cells[1].className).toContain('border-red-500');
    expect(cells[0].className).not.toContain('border-red-500');
  });

  it('rotation indicator shows degree badge when rotation > 0', () => {
    render(
      <ThumbnailGrid
        pdfBytes={mockPdfBytes}
        pageCount={3}
        rotations={{ 0: 90, 2: 270 }}
      />,
    );
    expect(screen.getByText(/90\s*°/)).toBeInTheDocument();
    expect(screen.getByText(/270\s*°/)).toBeInTheDocument();
  });

  it('does not show rotation badge when rotation is 0 or absent', () => {
    render(
      <ThumbnailGrid
        pdfBytes={mockPdfBytes}
        pageCount={2}
        rotations={{ 0: 0 }}
      />,
    );
    expect(screen.queryByText(/°/)).not.toBeInTheDocument();
  });

  it('keyboard ArrowRight moves focus to next cell', () => {
    const onPageClick = vi.fn();
    render(<ThumbnailGrid pdfBytes={mockPdfBytes} pageCount={4} onPageClick={onPageClick} />);
    const grid = screen.getByRole('grid');

    // Initially focused on index 0 - press ArrowRight to move to 1, then Space to select
    fireEvent.keyDown(grid, { key: 'ArrowRight' });
    fireEvent.keyDown(grid, { key: ' ' });
    expect(onPageClick).toHaveBeenCalledWith(1);
  });

  it('keyboard ArrowLeft moves focus to previous cell', () => {
    const onPageClick = vi.fn();
    render(<ThumbnailGrid pdfBytes={mockPdfBytes} pageCount={4} onPageClick={onPageClick} />);
    const grid = screen.getByRole('grid');

    // Move right twice, then left once: should be at index 1
    fireEvent.keyDown(grid, { key: 'ArrowRight' });
    fireEvent.keyDown(grid, { key: 'ArrowRight' });
    fireEvent.keyDown(grid, { key: 'ArrowLeft' });
    fireEvent.keyDown(grid, { key: 'Enter' });
    expect(onPageClick).toHaveBeenCalledWith(1);
  });

  it('keyboard Space triggers onPageClick on focused cell', () => {
    const onPageClick = vi.fn();
    render(<ThumbnailGrid pdfBytes={mockPdfBytes} pageCount={3} onPageClick={onPageClick} />);
    const grid = screen.getByRole('grid');

    // Focus is on 0 initially
    fireEvent.keyDown(grid, { key: ' ' });
    expect(onPageClick).toHaveBeenCalledWith(0);
  });

  it('keyboard Enter triggers onPageClick on focused cell', () => {
    const onPageClick = vi.fn();
    render(<ThumbnailGrid pdfBytes={mockPdfBytes} pageCount={3} onPageClick={onPageClick} />);
    const grid = screen.getByRole('grid');

    fireEvent.keyDown(grid, { key: 'ArrowRight' });
    fireEvent.keyDown(grid, { key: 'ArrowRight' });
    fireEvent.keyDown(grid, { key: 'Enter' });
    expect(onPageClick).toHaveBeenCalledWith(2);
  });

  it('ArrowLeft does not go below index 0', () => {
    const onPageClick = vi.fn();
    render(<ThumbnailGrid pdfBytes={mockPdfBytes} pageCount={3} onPageClick={onPageClick} />);
    const grid = screen.getByRole('grid');

    fireEvent.keyDown(grid, { key: 'ArrowLeft' });
    fireEvent.keyDown(grid, { key: ' ' });
    expect(onPageClick).toHaveBeenCalledWith(0);
  });

  it('ArrowRight does not exceed pageCount - 1', () => {
    const onPageClick = vi.fn();
    render(<ThumbnailGrid pdfBytes={mockPdfBytes} pageCount={2} onPageClick={onPageClick} />);
    const grid = screen.getByRole('grid');

    fireEvent.keyDown(grid, { key: 'ArrowRight' });
    fireEvent.keyDown(grid, { key: 'ArrowRight' });
    fireEvent.keyDown(grid, { key: 'ArrowRight' });
    fireEvent.keyDown(grid, { key: ' ' });
    expect(onPageClick).toHaveBeenCalledWith(1);
  });

  it('renders with zero pages without errors', () => {
    const { container } = render(<ThumbnailGrid pdfBytes={mockPdfBytes} pageCount={0} />);
    expect(screen.getByRole('grid')).toBeInTheDocument();
    expect(screen.queryAllByRole('gridcell')).toHaveLength(0);
  });

  it('selected page with "selected" overlay shows CheckCircle icon container', () => {
    const selected = new Set([0]);
    render(
      <ThumbnailGrid
        pdfBytes={mockPdfBytes}
        pageCount={1}
        selectedPages={selected}
        overlayType="selected"
      />,
    );
    const cells = screen.getAllByRole('gridcell');
    // The overlay div with bg-indigo-500/10 should be present
    const overlay = cells[0].querySelector('.bg-indigo-500\\/10');
    expect(overlay).toBeTruthy();
  });

  it('selected page with "delete" overlay shows Trash2 icon container', () => {
    const selected = new Set([0]);
    render(
      <ThumbnailGrid
        pdfBytes={mockPdfBytes}
        pageCount={1}
        selectedPages={selected}
        overlayType="delete"
      />,
    );
    const cells = screen.getAllByRole('gridcell');
    // The overlay div with bg-red-500/20 should be present
    const overlay = cells[0].querySelector('.bg-red-500\\/20');
    expect(overlay).toBeTruthy();
  });
});
