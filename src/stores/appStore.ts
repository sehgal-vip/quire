import { create } from 'zustand';

interface AppStore {
  currentView: 'grid' | 'tool' | 'pipeline';
  currentToolId: string | null;
  pipelineMode: boolean;
  pipelineSelection: string[];
  setView: (view: AppStore['currentView'], toolId?: string) => void;
  togglePipelineMode: () => void;
  togglePipelineTool: (toolId: string) => void;
  clearPipelineSelection: () => void;
  setPipelineSelection: (toolIds: string[]) => void;
}

function getInitialState() {
  const hash = window.location.hash.replace('#', '');
  if (hash === 'pipeline') {
    return { currentView: 'pipeline' as const, currentToolId: null, pipelineMode: true };
  }
  if (hash) {
    return { currentView: 'tool' as const, currentToolId: hash, pipelineMode: false };
  }
  return { currentView: 'grid' as const, currentToolId: null, pipelineMode: false };
}

export const useAppStore = create<AppStore>((set) => {
  const initial = getInitialState();
  return {
    ...initial,
    pipelineSelection: [],

    setView: (view, toolId) => {
      if (view === 'tool' && toolId) {
        window.location.hash = `#${toolId}`;
        set({ currentView: 'tool', currentToolId: toolId });
      } else if (view === 'pipeline') {
        window.location.hash = '#pipeline';
        set({ currentView: 'pipeline', currentToolId: null, pipelineMode: true });
      } else {
        window.location.hash = '';
        set({ currentView: 'grid', currentToolId: null });
      }
    },

    togglePipelineMode: () =>
      set((state) => ({
        pipelineMode: !state.pipelineMode,
        pipelineSelection: [],
      })),

    togglePipelineTool: (toolId) =>
      set((state) => {
        const idx = state.pipelineSelection.indexOf(toolId);
        if (idx >= 0) {
          return { pipelineSelection: state.pipelineSelection.filter((id) => id !== toolId) };
        }
        if (state.pipelineSelection.length >= 5) return state;
        return { pipelineSelection: [...state.pipelineSelection, toolId] };
      }),

    clearPipelineSelection: () => set({ pipelineSelection: [] }),

    setPipelineSelection: (toolIds) => set({ pipelineSelection: toolIds.slice(0, 5) }),
  };
});
