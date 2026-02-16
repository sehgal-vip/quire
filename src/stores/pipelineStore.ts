import { create } from 'zustand';
import type { ValidationResult, PipelinePreset } from '@/types';
import { validatePipeline } from '@/lib/pipeline-validator';

type StepStatus = 'pending' | 'configuring' | 'processing' | 'done' | 'failed' | 'skipped';

interface PipelineStore {
  // State
  selectedTools: string[];
  currentStep: number; // -1 = builder, 0 = file upload, 1+ = tool steps
  stepStatus: Record<number, StepStatus>;
  intermediateResults: Record<number, Uint8Array>;
  originalInput: Uint8Array | null;
  validation: ValidationResult;
  isExecuting: boolean;
  stepErrors: Record<number, string>;

  // Builder actions
  addTool: (toolId: string) => void;
  removeTool: (index: number) => void;
  reorderTools: (fromIndex: number, toIndex: number) => void;
  loadPreset: (preset: PipelinePreset) => void;
  clearPipeline: () => void;

  // Execution actions
  startPipeline: () => void;
  setOriginalInput: (bytes: Uint8Array) => void;
  advanceToStep: (stepIndex: number) => void;
  setStepConfiguring: (stepIndex: number) => void;
  setStepProcessing: (stepIndex: number) => void;
  completeStep: (stepIndex: number, outputBytes: Uint8Array) => void;
  failStep: (stepIndex: number, error: string) => void;
  skipStep: (stepIndex: number) => void;
  retryStep: (stepIndex: number) => void;
  cancelPipeline: () => void;
  resetPipeline: () => void;

  // Helpers
  getStepInput: (stepIndex: number) => Uint8Array | null;
  getLastSuccessfulOutput: () => Uint8Array | null;
}

const EMPTY_VALIDATION: ValidationResult = { valid: true, warnings: [] };

export const usePipelineStore = create<PipelineStore>()((set, get) => ({
  selectedTools: [],
  currentStep: -1,
  stepStatus: {},
  intermediateResults: {},
  originalInput: null,
  validation: EMPTY_VALIDATION,
  isExecuting: false,
  stepErrors: {},

  addTool: (toolId) =>
    set((state) => {
      if (state.selectedTools.length >= 5) return state;
      const next = [...state.selectedTools, toolId];
      return { selectedTools: next, validation: validatePipeline(next) };
    }),

  removeTool: (index) =>
    set((state) => {
      const next = state.selectedTools.filter((_, i) => i !== index);
      return { selectedTools: next, validation: validatePipeline(next) };
    }),

  reorderTools: (fromIndex, toIndex) =>
    set((state) => {
      const next = [...state.selectedTools];
      const [item] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, item);
      return { selectedTools: next, validation: validatePipeline(next) };
    }),

  loadPreset: (preset) =>
    set(() => {
      const tools = preset.tools.slice(0, 5);
      return { selectedTools: tools, validation: validatePipeline(tools) };
    }),

  clearPipeline: () =>
    set({
      selectedTools: [],
      currentStep: -1,
      stepStatus: {},
      intermediateResults: {},
      originalInput: null,
      validation: EMPTY_VALIDATION,
      isExecuting: false,
      stepErrors: {},
    }),

  startPipeline: () =>
    set((state) => {
      const status: Record<number, StepStatus> = {};
      for (let i = 1; i <= state.selectedTools.length; i++) {
        status[i] = 'pending';
      }
      return {
        isExecuting: true,
        currentStep: 0,
        stepStatus: status,
        intermediateResults: {},
        originalInput: null,
        stepErrors: {},
      };
    }),

  setOriginalInput: (bytes) =>
    set({ originalInput: bytes }),

  advanceToStep: (stepIndex) =>
    set((state) => {
      const newStatus = { ...state.stepStatus };
      if (newStatus[stepIndex] === 'pending') {
        newStatus[stepIndex] = 'configuring';
      }
      return { currentStep: stepIndex, stepStatus: newStatus };
    }),

  setStepConfiguring: (stepIndex) =>
    set((state) => ({
      stepStatus: { ...state.stepStatus, [stepIndex]: 'configuring' },
    })),

  setStepProcessing: (stepIndex) =>
    set((state) => ({
      stepStatus: { ...state.stepStatus, [stepIndex]: 'processing' },
    })),

  completeStep: (stepIndex, outputBytes) =>
    set((state) => {
      const newResults = { ...state.intermediateResults };
      // Memory management: only keep the last intermediate result + original
      // Discard results older than stepIndex - 1
      for (const key of Object.keys(newResults)) {
        const k = Number(key);
        if (k < stepIndex - 1) {
          delete newResults[k];
        }
      }
      newResults[stepIndex] = outputBytes;
      return {
        stepStatus: { ...state.stepStatus, [stepIndex]: 'done' },
        intermediateResults: newResults,
      };
    }),

  failStep: (stepIndex, error) =>
    set((state) => ({
      stepStatus: { ...state.stepStatus, [stepIndex]: 'failed' },
      stepErrors: { ...state.stepErrors, [stepIndex]: error },
    })),

  skipStep: (stepIndex) =>
    set((state) => {
      // Pass input through unchanged
      const input = get().getStepInput(stepIndex);
      const newResults = { ...state.intermediateResults };
      if (input) {
        // Clean old intermediates
        for (const key of Object.keys(newResults)) {
          const k = Number(key);
          if (k < stepIndex - 1) {
            delete newResults[k];
          }
        }
        newResults[stepIndex] = input;
      }
      return {
        stepStatus: { ...state.stepStatus, [stepIndex]: 'skipped' },
        intermediateResults: newResults,
      };
    }),

  retryStep: (stepIndex) =>
    set((state) => ({
      stepStatus: { ...state.stepStatus, [stepIndex]: 'configuring' },
      stepErrors: { ...state.stepErrors, [stepIndex]: '' },
    })),

  cancelPipeline: () =>
    set({ isExecuting: false, currentStep: -1 }),

  resetPipeline: () =>
    set({
      currentStep: -1,
      stepStatus: {},
      intermediateResults: {},
      originalInput: null,
      isExecuting: false,
      stepErrors: {},
    }),

  getStepInput: (stepIndex) => {
    const state = get();
    if (stepIndex <= 1) return state.originalInput;
    // Use the previous step's output
    for (let i = stepIndex - 1; i >= 1; i--) {
      if (state.intermediateResults[i]) return state.intermediateResults[i];
    }
    return state.originalInput;
  },

  getLastSuccessfulOutput: () => {
    const state = get();
    const steps = Object.keys(state.intermediateResults)
      .map(Number)
      .sort((a, b) => b - a);
    if (steps.length > 0) return state.intermediateResults[steps[0]];
    return state.originalInput;
  },
}));
