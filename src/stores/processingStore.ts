import { create } from 'zustand';
import type { Progress, ToolOutput } from '@/types';

interface ProcessingStore {
  status: 'idle' | 'processing' | 'done' | 'error' | 'cancelled';
  progress: Progress | null;
  result: ToolOutput | null;
  error: string | null;
  startTime: number | null;
  startProcessing: () => void;
  updateProgress: (progress: Progress) => void;
  setResult: (result: ToolOutput) => void;
  setError: (error: string) => void;
  cancel: () => void;
  reset: () => void;
}

export const useProcessingStore = create<ProcessingStore>()((set) => ({
  status: 'idle',
  progress: null,
  result: null,
  error: null,
  startTime: null,

  startProcessing: () => {
    set({
      status: 'processing',
      progress: null,
      result: null,
      error: null,
      startTime: Date.now(),
    });
  },

  updateProgress: (progress) => {
    set({ progress });
  },

  setResult: (result) => {
    set({ status: 'done', result, progress: null });
  },

  setError: (error) => {
    set({ status: 'error', error, progress: null });
  },

  cancel: () => {
    set({ status: 'cancelled', progress: null });
  },

  reset: () => {
    set({
      status: 'idle',
      progress: null,
      result: null,
      error: null,
      startTime: null,
    });
  },
}));
