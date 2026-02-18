import { parseHtmlToBlocks } from './html-parser';
import type { DocBlock } from './html-parser';
import { ERRORS } from './error-messages';

export type ConvertInputFile =
  | { type: 'image'; name: string; bytes: Uint8Array; mimeType: string; width: number; height: number }
  | { type: 'document'; name: string; blocks: DocBlock[] }
  | { type: 'text'; name: string; blocks: DocBlock[] };

export interface ConvertConfig {
  imagePageSize: 'A4' | 'Letter' | 'fit';
  imageOrientation: 'auto' | 'portrait' | 'landscape';
  imageFitMode: 'contain' | 'cover' | 'stretch' | 'original';
  docPageSize: 'A4' | 'Letter';
  docOrientation: 'portrait' | 'landscape';
  textFontSize: number;
  textLineHeight: number;
  margin: number;
}

export const DEFAULT_CONVERT_CONFIG: ConvertConfig = {
  imagePageSize: 'A4',
  imageOrientation: 'auto',
  imageFitMode: 'contain',
  docPageSize: 'A4',
  docOrientation: 'portrait',
  textFontSize: 12,
  textLineHeight: 1.5,
  margin: 36,
};

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(ERRORS.IMAGE_LOAD_FAILED));
    img.src = src;
  });
}

export async function preprocessImage(file: File): Promise<ConvertInputFile> {
  const objectURL = URL.createObjectURL(file);
  try {
    const img = await loadImage(objectURL);
    const width = img.naturalWidth;
    const height = img.naturalHeight;

    // Convert WebP and GIF to PNG via canvas for broader pdf-lib compatibility
    const ext = file.name.split('.').pop()?.toLowerCase();
    let bytes: Uint8Array;
    let mimeType: string;

    if (ext === 'webp' || ext === 'gif') {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0);
      const blob = await new Promise<Blob>((resolve) =>
        canvas.toBlob((b) => resolve(b!), 'image/png')
      );
      bytes = new Uint8Array(await blob.arrayBuffer());
      mimeType = 'image/png';
    } else {
      bytes = new Uint8Array(await file.arrayBuffer());
      mimeType = file.type || 'image/png';
    }

    return { type: 'image', name: file.name, bytes, mimeType, width, height };
  } finally {
    URL.revokeObjectURL(objectURL);
  }
}

export async function preprocessDocx(file: File): Promise<ConvertInputFile> {
  // Reject legacy .doc files
  if (file.name.toLowerCase().endsWith('.doc') && !file.name.toLowerCase().endsWith('.docx')) {
    throw new Error(ERRORS.DOC_NOT_SUPPORTED);
  }

  const mammoth = await import('mammoth');
  const arrayBuffer = await file.arrayBuffer();

  let result;
  try {
    result = await mammoth.convertToHtml({ arrayBuffer });
  } catch {
    throw new Error(ERRORS.DOCX_PARSE_FAILED);
  }

  const html = result.value;
  if (!html || html.trim().length === 0) {
    throw new Error(ERRORS.EMPTY_DOCUMENT);
  }

  const blocks = parseHtmlToBlocks(html);
  if (blocks.length === 0) {
    throw new Error(ERRORS.EMPTY_DOCUMENT);
  }

  return { type: 'document', name: file.name, blocks };
}

export async function preprocessTxt(file: File): Promise<ConvertInputFile> {
  const text = await file.text();

  if (text.trim().length === 0) {
    throw new Error(ERRORS.EMPTY_DOCUMENT);
  }

  // Split on double newlines to create paragraphs
  const paragraphs = text.split(/\n\s*\n/);
  const blocks: DocBlock[] = paragraphs
    .filter((p) => p.length > 0)
    .map((p) => ({
      type: 'paragraph' as const,
      runs: [{ text: p.trim(), bold: false, italic: false, underline: false }],
    }));

  return { type: 'text', name: file.name, blocks };
}

export function getFileType(file: File): 'image' | 'document' | 'text' | null {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  if (['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext)) return 'image';
  if (ext === 'docx') return 'document';
  if (ext === 'doc') return 'document'; // Will be rejected in preprocessDocx
  if (ext === 'txt') return 'text';
  return null;
}

export const ACCEPTED_EXTENSIONS = '.jpg,.jpeg,.png,.webp,.gif,.docx,.txt';
