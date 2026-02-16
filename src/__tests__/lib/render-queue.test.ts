import { RenderQueue } from '@/lib/render-queue';

describe('RenderQueue', () => {
  let queue: RenderQueue;

  beforeEach(() => {
    queue = new RenderQueue();
  });

  it('enqueue resolves with rendered value', async () => {
    const renderFn = vi.fn().mockResolvedValue('data:image/jpeg;base64,abc');
    const result = await queue.enqueue(0, 'high', renderFn);

    expect(result).toBe('data:image/jpeg;base64,abc');
    expect(renderFn).toHaveBeenCalledTimes(1);
  });

  it('high priority items processed before low priority', async () => {
    const order: number[] = [];

    // Create render functions that track execution order
    const createRenderFn = (index: number) => {
      return vi.fn().mockImplementation(async () => {
        order.push(index);
        return `result-${index}`;
      });
    };

    // Fill up the concurrent slots (max 3) with slow tasks to force queuing
    const blockers: Array<{ resolve: () => void }> = [];
    for (let i = 0; i < 3; i++) {
      const blocker: { resolve: () => void } = { resolve: () => {} };
      blockers.push(blocker);
      queue.enqueue(100 + i, 'low', () => new Promise<string>((resolve) => {
        blocker.resolve = () => resolve(`blocker-${i}`);
      }));
    }

    // Now enqueue low priority, then high priority
    const lowPromise = queue.enqueue(10, 'low', createRenderFn(10));
    const highPromise = queue.enqueue(20, 'high', createRenderFn(20));

    // Release blockers
    for (const b of blockers) b.resolve();

    await highPromise;
    await lowPromise;

    // High priority (20) should have been processed before low priority (10)
    const highIndex = order.indexOf(20);
    const lowIndex = order.indexOf(10);
    expect(highIndex).toBeLessThan(lowIndex);
  });

  it('cancel resolves cancelled item with null', async () => {
    // Fill up concurrent slots to force item into queue
    const blockers: Array<{ resolve: () => void }> = [];
    for (let i = 0; i < 3; i++) {
      const blocker: { resolve: () => void } = { resolve: () => {} };
      blockers.push(blocker);
      queue.enqueue(100 + i, 'low', () => new Promise<string>((resolve) => {
        blocker.resolve = () => resolve(`blocker-${i}`);
      }));
    }

    // Enqueue an item that will sit in the queue
    const renderFn = vi.fn().mockResolvedValue('should-not-return');
    const promise = queue.enqueue(5, 'low', renderFn);

    // Cancel it before it gets processed
    queue.cancel(5);

    // Release blockers so processing continues
    for (const b of blockers) b.resolve();

    const result = await promise;
    expect(result).toBeNull();
    // renderFn should NOT have been called since it was cancelled while queued
    expect(renderFn).not.toHaveBeenCalled();
  });

  it('cancelAll resolves all queued items with null', async () => {
    // Fill up concurrent slots
    const blockers: Array<{ resolve: () => void }> = [];
    for (let i = 0; i < 3; i++) {
      const blocker: { resolve: () => void } = { resolve: () => {} };
      blockers.push(blocker);
      queue.enqueue(100 + i, 'low', () => new Promise<string>((resolve) => {
        blocker.resolve = () => resolve(`blocker-${i}`);
      }));
    }

    // Enqueue items that will sit in the queue
    const promise1 = queue.enqueue(10, 'low', vi.fn().mockResolvedValue('a'));
    const promise2 = queue.enqueue(11, 'low', vi.fn().mockResolvedValue('b'));
    const promise3 = queue.enqueue(12, 'low', vi.fn().mockResolvedValue('c'));

    // Cancel all
    queue.cancelAll();

    // Release blockers
    for (const b of blockers) b.resolve();

    const [r1, r2, r3] = await Promise.all([promise1, promise2, promise3]);
    expect(r1).toBeNull();
    expect(r2).toBeNull();
    expect(r3).toBeNull();
  });

  it('limits to max 3 concurrent renders', async () => {
    let activeConcurrent = 0;
    let maxConcurrentObserved = 0;

    const createRenderFn = () => {
      return async () => {
        activeConcurrent++;
        maxConcurrentObserved = Math.max(maxConcurrentObserved, activeConcurrent);
        // Yield to allow other tasks to start if they can
        await new Promise<void>((resolve) => setTimeout(resolve, 10));
        activeConcurrent--;
        return 'done';
      };
    };

    // Enqueue 6 items
    const promises: Promise<string | null>[] = [];
    for (let i = 0; i < 6; i++) {
      promises.push(queue.enqueue(i, 'low', createRenderFn()));
    }

    await Promise.all(promises);

    // Max concurrent should never have exceeded 3
    expect(maxConcurrentObserved).toBe(3);
  });

  it('duplicate enqueue for same pageIndex replaces previous queued item', async () => {
    // Fill up concurrent slots
    const blockers: Array<{ resolve: () => void }> = [];
    for (let i = 0; i < 3; i++) {
      const blocker: { resolve: () => void } = { resolve: () => {} };
      blockers.push(blocker);
      queue.enqueue(100 + i, 'low', () => new Promise<string>((resolve) => {
        blocker.resolve = () => resolve(`blocker-${i}`);
      }));
    }

    // Enqueue page 5 with first render function
    const renderFn1 = vi.fn().mockResolvedValue('first');
    const promise1 = queue.enqueue(5, 'low', renderFn1);

    // Enqueue page 5 again with a different render function (replaces previous)
    const renderFn2 = vi.fn().mockResolvedValue('second');
    const promise2 = queue.enqueue(5, 'low', renderFn2);

    // Release blockers
    for (const b of blockers) b.resolve();

    const result2 = await promise2;
    expect(result2).toBe('second');
    expect(renderFn2).toHaveBeenCalledTimes(1);

    // First render function should NOT have been called since it was replaced
    expect(renderFn1).not.toHaveBeenCalled();
  });

  it('enqueue resolves with null when renderFn throws', async () => {
    const renderFn = vi.fn().mockRejectedValue(new Error('render failed'));
    const result = await queue.enqueue(0, 'high', renderFn);

    expect(result).toBeNull();
  });
});
