export interface ParseResult {
  pages: number[];
  error?: string;
}

export function parsePageRange(input: string, totalPages: number): ParseResult {
  if (!input.trim()) return { pages: [], error: 'Please enter a page range' };

  const pages = new Set<number>();
  const parts = input.split(',').map((s) => s.trim()).filter(Boolean);

  for (const part of parts) {
    if (part.includes('-')) {
      const [startStr, endStr] = part.split('-').map((s) => s.trim());
      const start = parseInt(startStr, 10);
      const end = endStr.toLowerCase() === 'end' ? totalPages : parseInt(endStr, 10);

      if (isNaN(start) || isNaN(end)) return { pages: [], error: `Invalid range: "${part}"` };
      if (start < 1 || end < 1) return { pages: [], error: 'Page numbers must be at least 1' };
      if (start > totalPages || end > totalPages) return { pages: [], error: `Page number exceeds total (${totalPages})` };
      if (start > end) return { pages: [], error: `Invalid range: ${start} > ${end}` };

      for (let i = start; i <= end; i++) pages.add(i);
    } else {
      const num = part.toLowerCase() === 'end' ? totalPages : parseInt(part, 10);
      if (isNaN(num)) return { pages: [], error: `Invalid page number: "${part}"` };
      if (num < 1 || num > totalPages) return { pages: [], error: `Page ${num} out of range (1-${totalPages})` };
      pages.add(num);
    }
  }

  return { pages: Array.from(pages).sort((a, b) => a - b) };
}

export function pagesToRangeString(pages: number[]): string {
  if (pages.length === 0) return '';
  const sorted = [...pages].sort((a, b) => a - b);
  const ranges: string[] = [];
  let start = sorted[0];
  let prev = sorted[0];

  for (let i = 1; i <= sorted.length; i++) {
    if (i < sorted.length && sorted[i] === prev + 1) {
      prev = sorted[i];
    } else {
      ranges.push(start === prev ? `${start}` : `${start}-${prev}`);
      if (i < sorted.length) {
        start = sorted[i];
        prev = sorted[i];
      }
    }
  }
  return ranges.join(', ');
}
