import { usePipelineStore } from '@/stores/pipelineStore';
import { PIPELINE_PRESETS } from '@/lib/pipeline-presets';

describe('pipelineStore', () => {
  beforeEach(() => {
    usePipelineStore.getState().clearPipeline();
  });

  it('T-ST-07: addTool enforces max 5', () => {
    for (const id of ['a', 'b', 'c', 'd', 'e']) {
      usePipelineStore.getState().addTool(id);
    }
    usePipelineStore.getState().addTool('f');
    expect(usePipelineStore.getState().selectedTools).toHaveLength(5);
    expect(usePipelineStore.getState().selectedTools).not.toContain('f');
  });

  it('addTool runs validation', () => {
    usePipelineStore.getState().addTool('encrypt');
    usePipelineStore.getState().addTool('rotate');
    expect(usePipelineStore.getState().validation.warnings.length).toBeGreaterThan(0);
  });

  it('removeTool removes by index', () => {
    usePipelineStore.getState().addTool('rotate');
    usePipelineStore.getState().addTool('scale');
    usePipelineStore.getState().removeTool(0);
    expect(usePipelineStore.getState().selectedTools).toEqual(['scale']);
  });

  it('T-ST-08: reorderTools moves tool', () => {
    usePipelineStore.getState().addTool('a');
    usePipelineStore.getState().addTool('b');
    usePipelineStore.getState().addTool('c');
    usePipelineStore.getState().reorderTools(0, 2);
    expect(usePipelineStore.getState().selectedTools).toEqual(['b', 'c', 'a']);
  });

  it('T-ST-10: loadPreset sets tools', () => {
    const preset = PIPELINE_PRESETS.find(p => p.id === 'scan-cleanup')!;
    usePipelineStore.getState().loadPreset(preset);
    expect(usePipelineStore.getState().selectedTools).toEqual(['unlock', 'delete-pages', 'add-page-numbers']);
  });

  it('clearPipeline resets everything', () => {
    usePipelineStore.getState().addTool('rotate');
    usePipelineStore.getState().startPipeline();
    usePipelineStore.getState().clearPipeline();
    const s = usePipelineStore.getState();
    expect(s.selectedTools).toEqual([]);
    expect(s.isExecuting).toBe(false);
    expect(s.currentStep).toBe(-1);
  });

  it('startPipeline sets execution state', () => {
    usePipelineStore.getState().addTool('rotate');
    usePipelineStore.getState().addTool('scale');
    usePipelineStore.getState().startPipeline();
    const s = usePipelineStore.getState();
    expect(s.isExecuting).toBe(true);
    expect(s.currentStep).toBe(0);
    expect(s.stepStatus[1]).toBe('pending');
    expect(s.stepStatus[2]).toBe('pending');
  });

  it('completeStep sets done and stores output', () => {
    usePipelineStore.getState().addTool('rotate');
    usePipelineStore.getState().startPipeline();
    const output = new Uint8Array([1, 2, 3]);
    usePipelineStore.getState().completeStep(1, output);
    expect(usePipelineStore.getState().stepStatus[1]).toBe('done');
    expect(usePipelineStore.getState().intermediateResults[1]).toBe(output);
  });

  it('T-ST-09: memory cleanup on completeStep', () => {
    usePipelineStore.getState().addTool('a');
    usePipelineStore.getState().addTool('b');
    usePipelineStore.getState().addTool('c');
    usePipelineStore.getState().startPipeline();
    usePipelineStore.getState().completeStep(1, new Uint8Array([1]));
    usePipelineStore.getState().completeStep(2, new Uint8Array([2]));
    usePipelineStore.getState().completeStep(3, new Uint8Array([3]));
    // Step 1 result should be cleaned up
    expect(usePipelineStore.getState().intermediateResults[1]).toBeUndefined();
    // Step 2 and 3 should still exist
    expect(usePipelineStore.getState().intermediateResults[2]).toBeDefined();
    expect(usePipelineStore.getState().intermediateResults[3]).toBeDefined();
  });

  it('failStep records error', () => {
    usePipelineStore.getState().addTool('rotate');
    usePipelineStore.getState().startPipeline();
    usePipelineStore.getState().failStep(1, 'Failed!');
    expect(usePipelineStore.getState().stepStatus[1]).toBe('failed');
    expect(usePipelineStore.getState().stepErrors[1]).toBe('Failed!');
  });

  it('skipStep passes input through', () => {
    usePipelineStore.getState().addTool('rotate');
    usePipelineStore.getState().addTool('scale');
    usePipelineStore.getState().startPipeline();
    usePipelineStore.getState().setOriginalInput(new Uint8Array([10, 20]));
    usePipelineStore.getState().skipStep(1);
    expect(usePipelineStore.getState().stepStatus[1]).toBe('skipped');
    expect(usePipelineStore.getState().intermediateResults[1]).toBeDefined();
  });

  it('retryStep resets to configuring', () => {
    usePipelineStore.getState().addTool('rotate');
    usePipelineStore.getState().startPipeline();
    usePipelineStore.getState().failStep(1, 'Failed');
    usePipelineStore.getState().retryStep(1);
    expect(usePipelineStore.getState().stepStatus[1]).toBe('configuring');
    expect(usePipelineStore.getState().stepErrors[1]).toBe('');
  });

  it('cancelPipeline stops execution', () => {
    usePipelineStore.getState().addTool('rotate');
    usePipelineStore.getState().startPipeline();
    usePipelineStore.getState().cancelPipeline();
    expect(usePipelineStore.getState().isExecuting).toBe(false);
    expect(usePipelineStore.getState().currentStep).toBe(-1);
  });

  it('getStepInput returns originalInput for step 1', () => {
    usePipelineStore.getState().addTool('rotate');
    usePipelineStore.getState().startPipeline();
    const input = new Uint8Array([5, 6, 7]);
    usePipelineStore.getState().setOriginalInput(input);
    expect(usePipelineStore.getState().getStepInput(1)).toBe(input);
  });

  it('getStepInput returns previous step output for step 2+', () => {
    usePipelineStore.getState().addTool('a');
    usePipelineStore.getState().addTool('b');
    usePipelineStore.getState().startPipeline();
    const input = new Uint8Array([1]);
    const step1Out = new Uint8Array([2]);
    usePipelineStore.getState().setOriginalInput(input);
    usePipelineStore.getState().completeStep(1, step1Out);
    expect(usePipelineStore.getState().getStepInput(2)).toBe(step1Out);
  });

  it('getLastSuccessfulOutput returns latest result', () => {
    usePipelineStore.getState().addTool('a');
    usePipelineStore.getState().addTool('b');
    usePipelineStore.getState().startPipeline();
    const out1 = new Uint8Array([1]);
    const out2 = new Uint8Array([2]);
    usePipelineStore.getState().completeStep(1, out1);
    usePipelineStore.getState().completeStep(2, out2);
    expect(usePipelineStore.getState().getLastSuccessfulOutput()).toBe(out2);
  });
});
