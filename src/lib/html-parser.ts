export interface TextRun {
  text: string;
  bold: boolean;
  italic: boolean;
  underline: boolean;
}

export interface DocBlock {
  type: 'paragraph' | 'heading' | 'list-item' | 'image';
  level?: number; // heading level (1-6)
  runs?: TextRun[];
  src?: string; // base64 data URI for images
  width?: number;
  height?: number;
}

function extractRuns(node: Node): TextRun[] {
  const runs: TextRun[] = [];

  function walk(n: Node, bold: boolean, italic: boolean, underline: boolean) {
    if (n.nodeType === Node.TEXT_NODE) {
      const text = n.textContent ?? '';
      if (text.length === 0) return; // Skip empty but do NOT trim
      runs.push({ text, bold, italic, underline });
      return;
    }

    if (n.nodeType !== Node.ELEMENT_NODE) return;

    const el = n as Element;
    const tag = el.tagName.toLowerCase();

    let nextBold = bold;
    let nextItalic = italic;
    let nextUnderline = underline;

    if (tag === 'strong' || tag === 'b') nextBold = true;
    if (tag === 'em' || tag === 'i') nextItalic = true;
    if (tag === 'u') nextUnderline = true;

    for (const child of Array.from(n.childNodes)) {
      walk(child, nextBold, nextItalic, nextUnderline);
    }
  }

  walk(node, false, false, false);
  return runs;
}

export function parseHtmlToBlocks(html: string): DocBlock[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const blocks: DocBlock[] = [];

  function processNode(node: Node) {
    if (node.nodeType !== Node.ELEMENT_NODE) return;

    const el = node as Element;
    const tag = el.tagName.toLowerCase();

    // Check <img> BEFORE <p> — mammoth wraps images in paragraphs
    if (tag === 'img') {
      const src = el.getAttribute('src') ?? '';
      blocks.push({ type: 'image', src });
      return;
    }

    // Check for image inside this element before processing as text
    const imgChild = el.querySelector('img');
    if (imgChild && tag === 'p') {
      // Process image first
      const src = imgChild.getAttribute('src') ?? '';
      blocks.push({ type: 'image', src });

      // Process remaining text content if any
      const textRuns: TextRun[] = [];
      for (const child of Array.from(el.childNodes)) {
        if (child.nodeType === Node.ELEMENT_NODE && (child as Element).tagName.toLowerCase() === 'img') continue;
        textRuns.push(...extractRuns(child));
      }
      if (textRuns.length > 0) {
        blocks.push({ type: 'paragraph', runs: textRuns });
      }
      return;
    }

    if (/^h[1-6]$/.test(tag)) {
      const level = parseInt(tag[1], 10);
      const runs = extractRuns(el);
      if (runs.length > 0) {
        blocks.push({ type: 'heading', level, runs });
      }
      return;
    }

    if (tag === 'p') {
      const runs = extractRuns(el);
      if (runs.length > 0) {
        blocks.push({ type: 'paragraph', runs });
      }
      return;
    }

    if (tag === 'li') {
      const runs = extractRuns(el);
      if (runs.length > 0) {
        blocks.push({ type: 'list-item', runs });
      }
      return;
    }

    if (tag === 'ul' || tag === 'ol' || tag === 'div' || tag === 'body' || tag === 'html' || tag === 'section' || tag === 'article') {
      for (const child of Array.from(el.children)) {
        processNode(child);
      }
      return;
    }

    // Fallback: treat as paragraph
    const runs = extractRuns(el);
    if (runs.length > 0) {
      blocks.push({ type: 'paragraph', runs });
    }
  }

  processNode(doc.body);
  return blocks;
}
