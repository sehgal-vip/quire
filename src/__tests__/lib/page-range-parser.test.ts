import { parsePageRange, pagesToRangeString } from '@/lib/page-range-parser';

describe('parsePageRange', () => {
  it('T-PR-01: parses single page', () => {
    const result = parsePageRange('3', 5);
    expect(result.pages).toEqual([3]);
    expect(result.error).toBeUndefined();
  });

  it('T-PR-02: parses range', () => {
    const result = parsePageRange('1-3', 5);
    expect(result.pages).toEqual([1, 2, 3]);
  });

  it('T-PR-03: parses mixed ranges and pages', () => {
    const result = parsePageRange('1, 3-5, 8', 10);
    expect(result.pages).toEqual([1, 3, 4, 5, 8]);
  });

  it('T-PR-04: supports "end" keyword', () => {
    const result = parsePageRange('3-end', 5);
    expect(result.pages).toEqual([3, 4, 5]);
  });

  it('T-PR-05: returns error for out of range page', () => {
    const result = parsePageRange('10', 5);
    expect(result.pages).toEqual([]);
    expect(result.error).toBeDefined();
  });

  it('T-PR-06: returns error for invalid input', () => {
    const result = parsePageRange('abc', 5);
    expect(result.pages).toEqual([]);
    expect(result.error).toBeDefined();
  });

  it('T-PR-07: deduplicates pages', () => {
    const result = parsePageRange('1, 1, 2', 5);
    expect(result.pages).toEqual([1, 2]);
  });

  it('returns error for empty input', () => {
    const result = parsePageRange('', 5);
    expect(result.pages).toEqual([]);
    expect(result.error).toBe('Please enter a page range');
  });

  it('returns error for reversed range', () => {
    const result = parsePageRange('5-1', 5);
    expect(result.pages).toEqual([]);
    expect(result.error).toContain('Invalid range');
  });

  it('returns error for page number less than 1', () => {
    const result = parsePageRange('0', 5);
    expect(result.pages).toEqual([]);
    expect(result.error).toBeDefined();
  });

  it('"end" keyword as single page', () => {
    const result = parsePageRange('end', 5);
    expect(result.pages).toEqual([5]);
  });
});

describe('pagesToRangeString', () => {
  it('returns empty string for empty array', () => {
    expect(pagesToRangeString([])).toBe('');
  });

  it('formats single page', () => {
    expect(pagesToRangeString([3])).toBe('3');
  });

  it('formats consecutive range', () => {
    expect(pagesToRangeString([1, 2, 3])).toBe('1-3');
  });

  it('formats mixed pages and ranges', () => {
    expect(pagesToRangeString([1, 3, 4, 5, 8])).toBe('1, 3-5, 8');
  });

  it('handles unsorted input', () => {
    expect(pagesToRangeString([5, 1, 3, 2])).toBe('1-3, 5');
  });
});
