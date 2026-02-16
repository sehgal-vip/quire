import { estimateTime, formatTime, formatDuration } from '@/lib/time-estimator';

describe('estimateTime', () => {
  it('returns positive number for all known tools', () => {
    const tools = ['split', 'merge', 'rotate', 'reorder', 'delete-pages', 'extract-pages',
      'add-blank-pages', 'add-page-numbers', 'text-watermark', 'scale', 'encrypt', 'unlock', 'edit-metadata'];
    for (const tool of tools) {
      expect(estimateTime(tool, 10, 1000)).toBeGreaterThan(0);
    }
  });

  it('returns 1 for unknown tool', () => {
    expect(estimateTime('unknown', 10, 1000)).toBe(1);
  });

  it('scales with page count', () => {
    const small = estimateTime('rotate', 1, 1000);
    const large = estimateTime('rotate', 100, 1000);
    expect(large).toBeGreaterThan(small);
  });
});

describe('formatTime', () => {
  it('formats sub-second as "< 1 second"', () => {
    expect(formatTime(0.5)).toBe('< 1 second');
  });

  it('formats seconds', () => {
    expect(formatTime(5)).toBe('~5 seconds');
  });

  it('formats minutes', () => {
    expect(formatTime(90)).toBe('~2 minutes');
  });
});

describe('formatDuration', () => {
  it('formats milliseconds', () => {
    expect(formatDuration(500)).toBe('500ms');
  });

  it('formats seconds', () => {
    expect(formatDuration(2500)).toBe('2.5s');
  });
});
