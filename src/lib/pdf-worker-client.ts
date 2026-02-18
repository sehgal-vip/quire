import type { ToolOutput } from '@/types';
import { useProcessingStore } from '@/stores/processingStore';

interface WorkerResponse {
  id: string;
  type: 'progress' | 'result' | 'error' | 'cancelled';
  progress?: { step: string; current: number; total: number };
  result?: { files: { name: string; bytes: ArrayBuffer; pageCount?: number }[] };
  error?: string;
}

class PDFWorkerClient {
  private worker: Worker;
  private pending = new Map<string, {
    resolve: (value: ToolOutput) => void;
    reject: (reason: string) => void;
  }>();

  constructor() {
    this.worker = new Worker(
      new URL('../workers/pdf-engine.worker.ts', import.meta.url),
      { type: 'module' }
    );
    this.worker.onmessage = this.handleMessage.bind(this);
    this.worker.onerror = this.handleError.bind(this);
  }

  private handleMessage(e: MessageEvent<WorkerResponse>) {
    const { id, type, progress, result, error } = e.data;
    const pendingReq = this.pending.get(id);
    if (!pendingReq) return;

    const store = useProcessingStore.getState();

    switch (type) {
      case 'progress':
        if (progress) store.updateProgress(progress);
        break;
      case 'result':
        if (result) {
          const toolOutput: ToolOutput = {
            files: result.files.map((f) => ({
              name: f.name,
              bytes: new Uint8Array(f.bytes),
              pageCount: f.pageCount ?? 0,
            })),
            processingTime: store.startTime ? Date.now() - store.startTime : 0,
          };
          store.setResult(toolOutput);
          pendingReq.resolve(toolOutput);
        } else {
          pendingReq.reject('Empty result from worker');
        }
        this.pending.delete(id);
        break;
      case 'error':
        store.setError(error ?? 'Unknown error');
        pendingReq.reject(error ?? 'Unknown error');
        this.pending.delete(id);
        break;
      case 'cancelled':
        store.cancel();
        pendingReq.reject('Operation cancelled');
        this.pending.delete(id);
        break;
    }
  }

  private handleError() {
    const store = useProcessingStore.getState();
    store.setError('Processing failed — this file may be too large. Try a smaller file or close other tabs.');
    for (const [id, pending] of this.pending) {
      pending.reject('Worker crashed');
      this.pending.delete(id);
    }
  }

  process(operation: string, pdfBytes: Uint8Array[], options: Record<string, unknown> = {}): Promise<ToolOutput> {
    const id = crypto.randomUUID();
    const store = useProcessingStore.getState();
    store.startProcessing();

    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      const transferCopies = pdfBytes.map((b) => new Uint8Array(b).buffer);
      this.worker.postMessage({ id, operation, pdfBytes: transferCopies, options }, transferCopies);
    });
  }

  processConvert(files: Array<{ type: string; bytes?: Uint8Array; blocks?: unknown; name: string; mimeType?: string; width?: number; height?: number }>, config: Record<string, unknown>): Promise<ToolOutput> {
    const id = crypto.randomUUID();
    const store = useProcessingStore.getState();
    store.startProcessing();

    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });

      // Extract unique ArrayBuffers for Transferables (prevents DataCloneError from shared buffers)
      const transferSet = new Set<ArrayBuffer>();
      for (const file of files) {
        if (file.bytes) {
          const copy = new Uint8Array(file.bytes).buffer;
          file.bytes = new Uint8Array(copy);
          transferSet.add(copy);
        }
      }

      const fontBytes = config.fontBytes as Record<string, Uint8Array> | undefined;
      if (fontBytes) {
        for (const key of Object.keys(fontBytes)) {
          const copy = new Uint8Array(fontBytes[key]).buffer;
          fontBytes[key] = new Uint8Array(copy);
          transferSet.add(copy);
        }
      }

      this.worker.postMessage(
        { id, operation: 'convert-to-pdf', pdfBytes: [], options: { files, config } },
        Array.from(transferSet)
      );
    });
  }

  cancelAll(): void {
    for (const id of this.pending.keys()) {
      this.worker.postMessage({ id, type: 'cancel' });
    }
  }
}

export const workerClient = new PDFWorkerClient();
