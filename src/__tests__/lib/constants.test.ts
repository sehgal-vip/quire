import { TOOLS, TOOL_MAP, CATEGORIES } from '@/lib/constants';

// Mock pdf-worker-client
vi.mock('@/lib/pdf-worker-client', () => ({
  workerClient: {
    cancelAll: vi.fn(),
    process: vi.fn(),
  },
}));

vi.mock('@/lib/thumbnail-renderer', () => ({
  renderPageThumbnail: vi.fn(),
  getPageCount: vi.fn(),
  clearDocumentCache: vi.fn(),
}));

vi.mock('pdfjs-dist', () => ({
  GlobalWorkerOptions: { workerSrc: '' },
  getDocument: vi.fn(),
}));

describe('TOOLS constants', () => {
  it('has exactly 13 tools', () => {
    expect(TOOLS).toHaveLength(13);
  });

  it('each tool has required fields', () => {
    for (const tool of TOOLS) {
      expect(tool.id).toBeTruthy();
      expect(tool.name).toBeTruthy();
      expect(tool.description).toBeTruthy();
      expect(tool.icon).toBeTruthy();
      expect(tool.category).toBeTruthy();
      expect(typeof tool.pipelineCompatible).toBe('boolean');
      expect(typeof tool.acceptsMultipleFiles).toBe('boolean');
      expect(typeof tool.estimateTime).toBe('function');
      expect(typeof tool.generateFilename).toBe('function');
    }
  });

  it('only merge accepts multiple files', () => {
    const multiFile = TOOLS.filter(t => t.acceptsMultipleFiles);
    expect(multiFile).toHaveLength(1);
    expect(multiFile[0].id).toBe('merge');
  });

  it('only merge is not pipeline compatible', () => {
    const notCompatible = TOOLS.filter(t => !t.pipelineCompatible);
    expect(notCompatible).toHaveLength(1);
    expect(notCompatible[0].id).toBe('merge');
  });

  it('TOOL_MAP has all tools', () => {
    expect(Object.keys(TOOL_MAP)).toHaveLength(13);
    expect(TOOL_MAP['split'].name).toBe('Split PDF');
    expect(TOOL_MAP['merge'].name).toBe('Merge PDFs');
  });
});

describe('CATEGORIES', () => {
  it('has 5 categories', () => {
    expect(Object.keys(CATEGORIES)).toHaveLength(5);
  });

  it('has correct category names', () => {
    expect(CATEGORIES.organize.label).toBe('Organize');
    expect(CATEGORIES.transform.label).toBe('Transform');
    expect(CATEGORIES.stamp.label).toBe('Stamp');
    expect(CATEGORIES.security.label).toBe('Security');
    expect(CATEGORIES.info.label).toBe('Info');
  });

  it('every tool belongs to a valid category', () => {
    const catKeys = Object.keys(CATEGORIES);
    for (const tool of TOOLS) {
      expect(catKeys).toContain(tool.category);
    }
  });
});
