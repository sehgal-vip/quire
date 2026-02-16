const estimates: Record<string, (pages: number, sizeBytes: number) => number> = {
  split: (p) => 0.5 + p * 0.01,
  merge: (p) => 0.5 + p * 0.02,
  rotate: (p) => 0.3 + p * 0.005,
  reorder: (p) => 0.5 + p * 0.01,
  'delete-pages': (p) => 0.5 + p * 0.01,
  'extract-pages': (p) => 0.5 + p * 0.01,
  'add-blank-pages': () => 0.5,
  'add-page-numbers': (p) => 1 + p * 0.05,
  'text-watermark': (p) => 1 + p * 0.05,
  scale: (p) => 1 + p * 0.03,
  encrypt: (p) => 0.5 + p * 0.02,
  unlock: () => 0.5,
  'edit-metadata': () => 0.3,
};

export function estimateTime(toolId: string, pageCount: number, fileSize: number): number {
  const fn = estimates[toolId];
  if (!fn) return 1;
  return Math.round(fn(pageCount, fileSize) * 10) / 10;
}

export function formatTime(seconds: number): string {
  if (seconds < 1) return '< 1 second';
  if (seconds < 60) return `~${Math.ceil(seconds)} seconds`;
  return `~${Math.ceil(seconds / 60)} minutes`;
}

export function formatDuration(ms: number): string {
  const seconds = ms / 1000;
  if (seconds < 1) return `${ms}ms`;
  return `${seconds.toFixed(1)}s`;
}
