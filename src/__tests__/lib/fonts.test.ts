import { detectRequiredFonts } from '@/lib/fonts';

describe('detectRequiredFonts', () => {
  it('detects Latin text', () => {
    const result = detectRequiredFonts('Hello World');
    expect(result.scripts).toContain('latin');
    expect(result.hasCJK).toBe(false);
  });

  it('detects Arabic text', () => {
    const result = detectRequiredFonts('مرحبا');
    expect(result.scripts).toContain('arabic');
    expect(result.scripts).toContain('latin');
    expect(result.hasCJK).toBe(false);
  });

  it('detects Devanagari text', () => {
    const result = detectRequiredFonts('नमस्ते');
    expect(result.scripts).toContain('devanagari');
    expect(result.hasCJK).toBe(false);
  });

  it('detects Cyrillic text', () => {
    const result = detectRequiredFonts('Привет');
    expect(result.scripts).toContain('cyrillic');
    expect(result.hasCJK).toBe(false);
  });

  it('detects CJK text', () => {
    const result = detectRequiredFonts('你好世界');
    expect(result.hasCJK).toBe(true);
  });

  it('detects mixed scripts', () => {
    const result = detectRequiredFonts('Hello مرحبا नमस्ते');
    expect(result.scripts).toContain('latin');
    expect(result.scripts).toContain('arabic');
    expect(result.scripts).toContain('devanagari');
    expect(result.hasCJK).toBe(false);
  });

  it('returns empty scripts for empty string', () => {
    const result = detectRequiredFonts('');
    expect(result.scripts).toHaveLength(0);
    expect(result.hasCJK).toBe(false);
  });
});
