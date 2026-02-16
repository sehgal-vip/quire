import { PIPELINE_PRESETS } from '@/lib/pipeline-presets';

describe('PIPELINE_PRESETS', () => {
  it('has 4 presets', () => {
    expect(PIPELINE_PRESETS).toHaveLength(4);
  });

  it('each preset has required fields', () => {
    for (const preset of PIPELINE_PRESETS) {
      expect(preset.id).toBeTruthy();
      expect(preset.name).toBeTruthy();
      expect(preset.description).toBeTruthy();
      expect(preset.icon).toBeTruthy();
      expect(preset.tools.length).toBeGreaterThanOrEqual(2);
    }
  });

  it('scan-cleanup preset has correct tools', () => {
    const preset = PIPELINE_PRESETS.find(p => p.id === 'scan-cleanup');
    expect(preset?.tools).toEqual(['unlock', 'delete-pages', 'add-page-numbers']);
  });

  it('secure-stamp preset has correct tools', () => {
    const preset = PIPELINE_PRESETS.find(p => p.id === 'secure-stamp');
    expect(preset?.tools).toEqual(['text-watermark', 'encrypt']);
  });

  it('no preset exceeds 5 tools', () => {
    for (const preset of PIPELINE_PRESETS) {
      expect(preset.tools.length).toBeLessThanOrEqual(5);
    }
  });

  it('no preset includes merge (not pipeline-compatible)', () => {
    for (const preset of PIPELINE_PRESETS) {
      expect(preset.tools).not.toContain('merge');
    }
  });
});
