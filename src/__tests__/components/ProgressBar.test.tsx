import { render, screen } from '@testing-library/react';
import { ProgressBar } from '@/components/common/ProgressBar';
import { useProcessingStore } from '@/stores/processingStore';

// Mock the worker client module
vi.mock('@/lib/pdf-worker-client', () => ({
  workerClient: {
    cancelAll: vi.fn(),
    process: vi.fn(),
  },
}));

describe('ProgressBar', () => {
  beforeEach(() => {
    useProcessingStore.getState().reset();
  });

  it('U-PB-01: renders nothing when idle', () => {
    const { container } = render(<ProgressBar />);
    expect(container.innerHTML).toBe('');
  });

  it('U-PB-02: shows pulsing bar when processing with no progress', () => {
    useProcessingStore.getState().startProcessing();
    render(<ProgressBar />);
    expect(screen.getByText('Processing...')).toBeInTheDocument();
  });

  it('U-PB-02b: shows determinate progress', () => {
    useProcessingStore.getState().startProcessing();
    useProcessingStore.getState().updateProgress({ step: 'Rotating', current: 3, total: 10 });
    render(<ProgressBar />);
    expect(screen.getByText('Rotating 3 of 10...')).toBeInTheDocument();
  });

  it('U-PB-03: shows Done when completed', () => {
    useProcessingStore.getState().startProcessing();
    useProcessingStore.getState().setResult({ files: [], processingTime: 100 });
    render(<ProgressBar />);
    expect(screen.getByText('Done')).toBeInTheDocument();
  });

  it('U-PB-04: shows error message', () => {
    useProcessingStore.getState().startProcessing();
    useProcessingStore.getState().setError('Something went wrong');
    render(<ProgressBar />);
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
  });

  it('U-PB-05: shows cancel button during processing', () => {
    useProcessingStore.getState().startProcessing();
    render(<ProgressBar />);
    expect(screen.getByLabelText('Cancel processing')).toBeInTheDocument();
  });

  it('shows Cancelled text when cancelled', () => {
    useProcessingStore.getState().startProcessing();
    useProcessingStore.getState().cancel();
    render(<ProgressBar />);
    expect(screen.getByText('Cancelled')).toBeInTheDocument();
  });

  it('U-PB-06: has ARIA progressbar role', () => {
    useProcessingStore.getState().startProcessing();
    render(<ProgressBar />);
    const bar = screen.getByRole('progressbar');
    expect(bar).toHaveAttribute('aria-valuemin', '0');
    expect(bar).toHaveAttribute('aria-valuemax', '100');
    expect(bar).toHaveAttribute('aria-label', 'Processing');
  });

  it('ARIA label changes for done state', () => {
    useProcessingStore.getState().startProcessing();
    useProcessingStore.getState().setResult({ files: [], processingTime: 100 });
    render(<ProgressBar />);
    const bar = screen.getByRole('progressbar');
    expect(bar).toHaveAttribute('aria-label', 'Processing complete');
    expect(bar).toHaveAttribute('aria-valuenow', '100');
  });

  it('ARIA label changes for error state', () => {
    useProcessingStore.getState().startProcessing();
    useProcessingStore.getState().setError('fail');
    render(<ProgressBar />);
    const bar = screen.getByRole('progressbar');
    expect(bar).toHaveAttribute('aria-label', 'Processing failed');
  });
});
