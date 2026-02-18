import { parseHtmlToBlocks } from '@/lib/html-parser';

describe('parseHtmlToBlocks', () => {
  it('parses a simple paragraph', () => {
    const blocks = parseHtmlToBlocks('<p>Hello world</p>');
    expect(blocks).toHaveLength(1);
    expect(blocks[0].type).toBe('paragraph');
    expect(blocks[0].runs).toHaveLength(1);
    expect(blocks[0].runs![0].text).toBe('Hello world');
    expect(blocks[0].runs![0].bold).toBe(false);
    expect(blocks[0].runs![0].italic).toBe(false);
  });

  it('parses headings with correct levels', () => {
    const blocks = parseHtmlToBlocks('<h1>Title</h1><h2>Subtitle</h2><h3>Section</h3>');
    expect(blocks).toHaveLength(3);
    expect(blocks[0].type).toBe('heading');
    expect(blocks[0].level).toBe(1);
    expect(blocks[1].level).toBe(2);
    expect(blocks[2].level).toBe(3);
  });

  it('parses bold text', () => {
    const blocks = parseHtmlToBlocks('<p>Hello <strong>bold</strong> world</p>');
    expect(blocks[0].runs).toHaveLength(3);
    expect(blocks[0].runs![0].text).toBe('Hello ');
    expect(blocks[0].runs![0].bold).toBe(false);
    expect(blocks[0].runs![1].text).toBe('bold');
    expect(blocks[0].runs![1].bold).toBe(true);
    expect(blocks[0].runs![2].text).toBe(' world');
  });

  it('parses italic text', () => {
    const blocks = parseHtmlToBlocks('<p>Hello <em>italic</em> world</p>');
    expect(blocks[0].runs![1].italic).toBe(true);
  });

  it('parses underline text', () => {
    const blocks = parseHtmlToBlocks('<p>Hello <u>underline</u> world</p>');
    expect(blocks[0].runs![1].underline).toBe(true);
  });

  it('parses nested formatting (bold + italic)', () => {
    const blocks = parseHtmlToBlocks('<p><strong><em>bold italic</em></strong></p>');
    expect(blocks[0].runs![0].bold).toBe(true);
    expect(blocks[0].runs![0].italic).toBe(true);
  });

  it('preserves whitespace between elements (does NOT trim)', () => {
    const blocks = parseHtmlToBlocks('<p>Hello <strong>world</strong> !</p>');
    // Should have "Hello ", "world", " !"
    const texts = blocks[0].runs!.map(r => r.text);
    expect(texts.join('')).toBe('Hello world !');
  });

  it('checks images BEFORE paragraphs', () => {
    // mammoth wraps <img> in <p>
    const html = '<p><img src="data:image/png;base64,abc"/></p>';
    const blocks = parseHtmlToBlocks(html);
    expect(blocks.length).toBeGreaterThanOrEqual(1);
    expect(blocks[0].type).toBe('image');
    expect(blocks[0].src).toBe('data:image/png;base64,abc');
  });

  it('parses standalone images', () => {
    const blocks = parseHtmlToBlocks('<img src="data:image/jpeg;base64,xyz"/>');
    expect(blocks).toHaveLength(1);
    expect(blocks[0].type).toBe('image');
  });

  it('parses lists', () => {
    const html = '<ul><li>Item 1</li><li>Item 2</li></ul>';
    const blocks = parseHtmlToBlocks(html);
    expect(blocks).toHaveLength(2);
    expect(blocks[0].type).toBe('list-item');
    expect(blocks[0].runs![0].text).toBe('Item 1');
    expect(blocks[1].type).toBe('list-item');
  });

  it('handles empty paragraphs', () => {
    const blocks = parseHtmlToBlocks('<p></p><p>Content</p>');
    // Empty paragraphs should be skipped
    expect(blocks).toHaveLength(1);
    expect(blocks[0].runs![0].text).toBe('Content');
  });

  it('handles mixed content', () => {
    const html = '<h1>Title</h1><p>Paragraph with <strong>bold</strong></p><ul><li>List item</li></ul>';
    const blocks = parseHtmlToBlocks(html);
    expect(blocks).toHaveLength(3);
    expect(blocks[0].type).toBe('heading');
    expect(blocks[1].type).toBe('paragraph');
    expect(blocks[2].type).toBe('list-item');
  });

  it('handles <b> tag same as <strong>', () => {
    const blocks = parseHtmlToBlocks('<p><b>bold</b></p>');
    expect(blocks[0].runs![0].bold).toBe(true);
  });

  it('handles <i> tag same as <em>', () => {
    const blocks = parseHtmlToBlocks('<p><i>italic</i></p>');
    expect(blocks[0].runs![0].italic).toBe(true);
  });

  it('handles empty input', () => {
    const blocks = parseHtmlToBlocks('');
    expect(blocks).toHaveLength(0);
  });

  it('handles image followed by text in same paragraph', () => {
    const html = '<p><img src="data:image/png;base64,img"/>Caption text</p>';
    const blocks = parseHtmlToBlocks(html);
    // Should have image first, then text
    const imageBlock = blocks.find(b => b.type === 'image');
    const textBlock = blocks.find(b => b.type === 'paragraph');
    expect(imageBlock).toBeDefined();
    expect(textBlock).toBeDefined();
    expect(textBlock!.runs![0].text).toBe('Caption text');
  });
});
