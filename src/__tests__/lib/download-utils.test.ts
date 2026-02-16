import { formatFileSize } from '@/lib/download-utils';

describe('formatFileSize', () => {
  it('T-DL-03: formats bytes', () => {
    expect(formatFileSize(500)).toBe('500 B');
  });

  it('T-DL-04: formats kilobytes', () => {
    expect(formatFileSize(2048)).toBe('2.0 KB');
  });

  it('T-DL-05: formats megabytes', () => {
    expect(formatFileSize(5242880)).toBe('5.0 MB');
  });

  it('formats zero bytes', () => {
    expect(formatFileSize(0)).toBe('0 B');
  });

  it('formats boundary at 1 KB', () => {
    expect(formatFileSize(1024)).toBe('1.0 KB');
  });

  it('formats boundary at 1 MB', () => {
    expect(formatFileSize(1024 * 1024)).toBe('1.0 MB');
  });
});
