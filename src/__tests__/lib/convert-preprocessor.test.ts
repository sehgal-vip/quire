import { preprocessTxt, getFileType, ACCEPTED_EXTENSIONS } from '@/lib/convert-preprocessor';

describe('preprocessTxt', () => {
  it('converts text into paragraph blocks', async () => {
    const file = new File(['Hello world\n\nSecond paragraph'], 'test.txt', { type: 'text/plain' });
    const result = await preprocessTxt(file);

    expect(result.type).toBe('text');
    expect(result.name).toBe('test.txt');
    expect(result.blocks.length).toBe(2);
    expect(result.blocks[0].type).toBe('paragraph');
    expect(result.blocks[0].runs![0].text).toBe('Hello world');
    expect(result.blocks[1].runs![0].text).toBe('Second paragraph');
  });

  it('throws on empty file', async () => {
    const file = new File([''], 'empty.txt', { type: 'text/plain' });
    await expect(preprocessTxt(file)).rejects.toThrow('empty');
  });

  it('throws on whitespace-only file', async () => {
    const file = new File(['   \n\n   '], 'blank.txt', { type: 'text/plain' });
    await expect(preprocessTxt(file)).rejects.toThrow('empty');
  });

  it('handles single paragraph (no double newline)', async () => {
    const file = new File(['Single paragraph text'], 'simple.txt', { type: 'text/plain' });
    const result = await preprocessTxt(file);
    expect(result.blocks).toHaveLength(1);
  });

  it('runs have correct default formatting flags', async () => {
    const file = new File(['Text'], 'test.txt', { type: 'text/plain' });
    const result = await preprocessTxt(file);
    const run = result.blocks[0].runs![0];
    expect(run.bold).toBe(false);
    expect(run.italic).toBe(false);
    expect(run.underline).toBe(false);
  });
});

describe('getFileType', () => {
  it('detects image files', () => {
    expect(getFileType(new File([], 'photo.jpg'))).toBe('image');
    expect(getFileType(new File([], 'photo.jpeg'))).toBe('image');
    expect(getFileType(new File([], 'photo.png'))).toBe('image');
    expect(getFileType(new File([], 'photo.webp'))).toBe('image');
    expect(getFileType(new File([], 'photo.gif'))).toBe('image');
  });

  it('detects document files', () => {
    expect(getFileType(new File([], 'doc.docx'))).toBe('document');
    expect(getFileType(new File([], 'doc.doc'))).toBe('document');
  });

  it('detects text files', () => {
    expect(getFileType(new File([], 'readme.txt'))).toBe('text');
  });

  it('returns null for unsupported types', () => {
    expect(getFileType(new File([], 'archive.zip'))).toBeNull();
    expect(getFileType(new File([], 'style.css'))).toBeNull();
    expect(getFileType(new File([], 'data.pdf'))).toBeNull();
  });
});

describe('ACCEPTED_EXTENSIONS', () => {
  it('includes all expected extensions', () => {
    expect(ACCEPTED_EXTENSIONS).toContain('.jpg');
    expect(ACCEPTED_EXTENSIONS).toContain('.jpeg');
    expect(ACCEPTED_EXTENSIONS).toContain('.png');
    expect(ACCEPTED_EXTENSIONS).toContain('.webp');
    expect(ACCEPTED_EXTENSIONS).toContain('.gif');
    expect(ACCEPTED_EXTENSIONS).toContain('.docx');
    expect(ACCEPTED_EXTENSIONS).toContain('.txt');
  });
});
