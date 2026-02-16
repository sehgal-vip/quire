import { useAppStore } from '@/stores/appStore';

describe('appStore', () => {
  beforeEach(() => {
    window.location.hash = '';
    useAppStore.setState({
      currentView: 'grid',
      currentToolId: null,
      pipelineMode: false,
      pipelineSelection: [],
    });
  });

  it('T-ST-01: initializes with grid view by default', () => {
    expect(useAppStore.getState().currentView).toBe('grid');
  });

  it('setView to tool updates hash and state', () => {
    useAppStore.getState().setView('tool', 'split');
    const state = useAppStore.getState();
    expect(state.currentView).toBe('tool');
    expect(state.currentToolId).toBe('split');
    expect(window.location.hash).toBe('#split');
  });

  it('setView to pipeline', () => {
    useAppStore.getState().setView('pipeline');
    const state = useAppStore.getState();
    expect(state.currentView).toBe('pipeline');
    expect(state.pipelineMode).toBe(true);
    expect(window.location.hash).toBe('#pipeline');
  });

  it('setView to grid clears hash', () => {
    useAppStore.getState().setView('tool', 'split');
    useAppStore.getState().setView('grid');
    expect(useAppStore.getState().currentView).toBe('grid');
    expect(window.location.hash).toBe('');
  });

  it('T-ST-02: togglePipelineMode toggles and clears selection', () => {
    useAppStore.getState().togglePipelineTool('rotate');
    expect(useAppStore.getState().pipelineSelection).toHaveLength(1);
    useAppStore.getState().togglePipelineMode();
    expect(useAppStore.getState().pipelineMode).toBe(true);
    expect(useAppStore.getState().pipelineSelection).toEqual([]);
  });

  it('togglePipelineTool adds and removes', () => {
    useAppStore.getState().togglePipelineTool('rotate');
    expect(useAppStore.getState().pipelineSelection).toContain('rotate');
    useAppStore.getState().togglePipelineTool('rotate');
    expect(useAppStore.getState().pipelineSelection).not.toContain('rotate');
  });

  it('togglePipelineTool enforces max 5', () => {
    for (const id of ['a', 'b', 'c', 'd', 'e']) {
      useAppStore.getState().togglePipelineTool(id);
    }
    useAppStore.getState().togglePipelineTool('f');
    expect(useAppStore.getState().pipelineSelection).toHaveLength(5);
    expect(useAppStore.getState().pipelineSelection).not.toContain('f');
  });

  it('clearPipelineSelection empties the array', () => {
    useAppStore.getState().togglePipelineTool('rotate');
    useAppStore.getState().clearPipelineSelection();
    expect(useAppStore.getState().pipelineSelection).toEqual([]);
  });

  it('setPipelineSelection sets tools, caps at 5', () => {
    useAppStore.getState().setPipelineSelection(['a', 'b', 'c', 'd', 'e', 'f']);
    expect(useAppStore.getState().pipelineSelection).toHaveLength(5);
  });
});
