import { render, screen, fireEvent } from '@testing-library/react';
import { BatchSelectionBar } from '@/components/common/BatchSelectionBar';

describe('BatchSelectionBar', () => {
  const defaultProps = {
    pageCount: 10,
    selectedCount: 3,
    onSelectAll: vi.fn(),
    onSelectEven: vi.fn(),
    onSelectOdd: vi.fn(),
    onInvert: vi.fn(),
    onClear: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('displays selection count text', () => {
    render(<BatchSelectionBar {...defaultProps} />);
    expect(screen.getByText('3 of 10 selected')).toBeInTheDocument();
  });

  it('updates selection count when props change', () => {
    const { rerender } = render(<BatchSelectionBar {...defaultProps} />);
    expect(screen.getByText('3 of 10 selected')).toBeInTheDocument();

    rerender(<BatchSelectionBar {...defaultProps} selectedCount={7} pageCount={20} />);
    expect(screen.getByText('7 of 20 selected')).toBeInTheDocument();
  });

  it('shows zero selection count', () => {
    render(<BatchSelectionBar {...defaultProps} selectedCount={0} />);
    expect(screen.getByText('0 of 10 selected')).toBeInTheDocument();
  });

  it('renders All button', () => {
    render(<BatchSelectionBar {...defaultProps} />);
    expect(screen.getByText('All')).toBeInTheDocument();
  });

  it('renders Even button', () => {
    render(<BatchSelectionBar {...defaultProps} />);
    expect(screen.getByText('Even')).toBeInTheDocument();
  });

  it('renders Odd button', () => {
    render(<BatchSelectionBar {...defaultProps} />);
    expect(screen.getByText('Odd')).toBeInTheDocument();
  });

  it('renders Invert button', () => {
    render(<BatchSelectionBar {...defaultProps} />);
    expect(screen.getByText('Invert')).toBeInTheDocument();
  });

  it('renders Clear button', () => {
    render(<BatchSelectionBar {...defaultProps} />);
    expect(screen.getByText('Clear')).toBeInTheDocument();
  });

  it('calls onSelectAll when All button is clicked', () => {
    render(<BatchSelectionBar {...defaultProps} />);
    fireEvent.click(screen.getByText('All'));
    expect(defaultProps.onSelectAll).toHaveBeenCalledOnce();
  });

  it('calls onSelectEven when Even button is clicked', () => {
    render(<BatchSelectionBar {...defaultProps} />);
    fireEvent.click(screen.getByText('Even'));
    expect(defaultProps.onSelectEven).toHaveBeenCalledOnce();
  });

  it('calls onSelectOdd when Odd button is clicked', () => {
    render(<BatchSelectionBar {...defaultProps} />);
    fireEvent.click(screen.getByText('Odd'));
    expect(defaultProps.onSelectOdd).toHaveBeenCalledOnce();
  });

  it('calls onInvert when Invert button is clicked', () => {
    render(<BatchSelectionBar {...defaultProps} />);
    fireEvent.click(screen.getByText('Invert'));
    expect(defaultProps.onInvert).toHaveBeenCalledOnce();
  });

  it('calls onClear when Clear button is clicked', () => {
    render(<BatchSelectionBar {...defaultProps} />);
    fireEvent.click(screen.getByText('Clear'));
    expect(defaultProps.onClear).toHaveBeenCalledOnce();
  });

  it('renders all 5 action buttons', () => {
    render(<BatchSelectionBar {...defaultProps} />);
    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(5);
  });
});
