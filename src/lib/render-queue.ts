type RenderFn = () => Promise<string | null>;

interface QueueItem {
  pageIndex: number;
  priority: 'high' | 'low';
  renderFn: RenderFn;
  resolve: (value: string | null) => void;
}

export class RenderQueue {
  private queue: QueueItem[] = [];
  private active = 0;
  private maxConcurrent = 3;
  private cancelledSet = new Set<number>();

  enqueue(pageIndex: number, priority: 'high' | 'low', renderFn: RenderFn): Promise<string | null> {
    this.cancelledSet.delete(pageIndex);
    // Remove existing entry for this page
    this.queue = this.queue.filter((item) => item.pageIndex !== pageIndex);

    return new Promise((resolve) => {
      const item: QueueItem = { pageIndex, priority, renderFn, resolve };
      if (priority === 'high') {
        this.queue.unshift(item);
      } else {
        this.queue.push(item);
      }
      this.processNext();
    });
  }

  cancel(pageIndex: number): void {
    this.cancelledSet.add(pageIndex);
    this.queue = this.queue.filter((item) => {
      if (item.pageIndex === pageIndex) {
        item.resolve(null);
        return false;
      }
      return true;
    });
  }

  cancelAll(): void {
    for (const item of this.queue) {
      this.cancelledSet.add(item.pageIndex);
      item.resolve(null);
    }
    this.queue = [];
  }

  private async processNext(): Promise<void> {
    if (this.active >= this.maxConcurrent || this.queue.length === 0) return;

    const item = this.queue.shift();
    if (!item) return;

    if (this.cancelledSet.has(item.pageIndex)) {
      item.resolve(null);
      this.processNext();
      return;
    }

    this.active++;
    try {
      const result = await item.renderFn();
      if (!this.cancelledSet.has(item.pageIndex)) {
        item.resolve(result);
      } else {
        item.resolve(null);
      }
    } catch {
      item.resolve(null);
    } finally {
      this.active--;
      this.processNext();
    }
  }
}

export const renderQueue = new RenderQueue();
