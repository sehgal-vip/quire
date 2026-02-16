import { useProcessingStore } from '@/stores/processingStore';

describe('processingStore', () => {
  beforeEach(() => {
    useProcessingStore.getState().reset();
  });

  it('T-ST-05: lifecycle idle -> processing -> done', () => {
    expect(useProcessingStore.getState().status).toBe('idle');

    useProcessingStore.getState().startProcessing();
    expect(useProcessingStore.getState().status).toBe('processing');
    expect(useProcessingStore.getState().startTime).toBeGreaterThan(0);

    useProcessingStore.getState().updateProgress({ step: 'Processing', current: 5, total: 10 });
    expect(useProcessingStore.getState().progress?.current).toBe(5);

    useProcessingStore.getState().setResult({ files: [], processingTime: 100 });
    expect(useProcessingStore.getState().status).toBe('done');
    expect(useProcessingStore.getState().progress).toBeNull();
  });

  it('setError transitions to error state', () => {
    useProcessingStore.getState().startProcessing();
    useProcessingStore.getState().setError('Something failed');
    expect(useProcessingStore.getState().status).toBe('error');
    expect(useProcessingStore.getState().error).toBe('Something failed');
  });

  it('cancel transitions to cancelled', () => {
    useProcessingStore.getState().startProcessing();
    useProcessingStore.getState().cancel();
    expect(useProcessingStore.getState().status).toBe('cancelled');
  });

  it('T-ST-06: reset returns all fields to initial', () => {
    useProcessingStore.getState().startProcessing();
    useProcessingStore.getState().setError('fail');
    useProcessingStore.getState().reset();
    const s = useProcessingStore.getState();
    expect(s.status).toBe('idle');
    expect(s.progress).toBeNull();
    expect(s.result).toBeNull();
    expect(s.error).toBeNull();
    expect(s.startTime).toBeNull();
  });
});
