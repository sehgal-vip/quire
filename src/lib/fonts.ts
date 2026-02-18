export type ScriptFont = 'latin' | 'arabic' | 'devanagari' | 'cyrillic';

interface FontDetectionResult {
  scripts: ScriptFont[];
  hasCJK: boolean;
}

const fontCache = new Map<string, Uint8Array>();

const FONT_FILES: Record<ScriptFont, string> = {
  latin: 'NotoSans-Regular.ttf',
  cyrillic: 'NotoSans-Regular.ttf', // Same file covers Cyrillic + Greek
  arabic: 'NotoSansArabic-Regular.ttf',
  devanagari: 'NotoSansDevanagari-Regular.ttf',
};

// Unicode ranges
const CJK_RANGE = /[\u4E00-\u9FFF\u3000-\u303F\u3040-\u309F\u30A0-\u30FF\uAC00-\uD7AF\uFF00-\uFFEF]/;
const ARABIC_RANGE = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;
const DEVANAGARI_RANGE = /[\u0900-\u097F\uA8E0-\uA8FF]/;
const CYRILLIC_RANGE = /[\u0400-\u04FF\u0500-\u052F]/;
const GREEK_RANGE = /[\u0370-\u03FF\u1F00-\u1FFF]/;

export function detectRequiredFonts(text: string): FontDetectionResult {
  const scripts = new Set<ScriptFont>();
  const hasCJK = CJK_RANGE.test(text);

  if (ARABIC_RANGE.test(text)) scripts.add('arabic');
  if (DEVANAGARI_RANGE.test(text)) scripts.add('devanagari');
  if (CYRILLIC_RANGE.test(text) || GREEK_RANGE.test(text)) scripts.add('cyrillic');

  // Latin is the default if there's any text at all
  if (text.length > 0) scripts.add('latin');

  return { scripts: Array.from(scripts), hasCJK };
}

export async function getNotoSansFont(script: ScriptFont): Promise<Uint8Array> {
  const fileName = FONT_FILES[script];
  const cached = fontCache.get(fileName);
  if (cached) return cached;

  const url = `${import.meta.env.BASE_URL}fonts/${fileName}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to load font: ${fileName}`);
  }

  const buffer = await response.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  fontCache.set(fileName, bytes);
  return bytes;
}
