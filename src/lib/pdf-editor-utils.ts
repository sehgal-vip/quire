/**
 * All stored coordinates are in PDF space (points, bottom-left origin).
 * Screen conversion happens ONLY at render time.
 *
 * NOTE: This file is used on the main thread. Do NOT import pdf-lib here.
 * Font helper functions return string keys that the worker maps to StandardFonts.
 */

interface Viewport {
  convertToPdfPoint: (x: number, y: number) => [number, number];
  convertToViewportPoint: (x: number, y: number) => [number, number];
  width: number;
  height: number;
  scale: number;
}

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface CanvasRect {
  left: number;
  top: number;
}

/**
 * Convert screen coordinates (relative to canvas) to PDF space coordinates.
 */
export function screenToPDF(
  clickX: number,
  clickY: number,
  canvasRect: CanvasRect,
  viewport: Viewport
): { x: number; y: number } {
  const relX = clickX - canvasRect.left;
  const relY = clickY - canvasRect.top;
  const [pdfX, pdfY] = viewport.convertToPdfPoint(relX, relY);
  return { x: pdfX, y: pdfY };
}

/**
 * Convert PDF space coordinates to screen coordinates.
 */
export function pdfToScreen(
  pdfX: number,
  pdfY: number,
  viewport: Viewport
): { x: number; y: number } {
  const [screenX, screenY] = viewport.convertToViewportPoint(pdfX, pdfY);
  return { x: screenX, y: screenY };
}

/**
 * Convert a PDF-space rect to screen-space CSS positioning.
 */
export function pdfRectToScreen(
  bounds: Rect,
  viewport: Viewport
): { left: number; top: number; width: number; height: number } {
  // Convert bottom-left corner to screen
  const topLeft = pdfToScreen(bounds.x, bounds.y + bounds.height, viewport);
  const bottomRight = pdfToScreen(bounds.x + bounds.width, bounds.y, viewport);

  return {
    left: topLeft.x,
    top: topLeft.y,
    width: bottomRight.x - topLeft.x,
    height: bottomRight.y - topLeft.y,
  };
}

/**
 * Get the correct StandardFonts key string for a font family + bold/italic combination.
 * Returns a string key that maps to pdf-lib StandardFonts enum (used in the worker).
 */
export function getStandardFont(family: string, bold: boolean, italic: boolean): string {
  if (family === 'Courier') {
    if (bold && italic) return 'CourierBoldOblique';
    if (bold) return 'CourierBold';
    if (italic) return 'CourierOblique';
    return 'Courier';
  }
  if (family === 'TimesRoman') {
    if (bold && italic) return 'TimesRomanBoldItalic';
    if (bold) return 'TimesRomanBold';
    if (italic) return 'TimesRomanItalic';
    return 'TimesRoman';
  }
  // Helvetica (default)
  if (bold && italic) return 'HelveticaBoldOblique';
  if (bold) return 'HelveticaBold';
  if (italic) return 'HelveticaOblique';
  return 'Helvetica';
}

/**
 * Map PDF.js font names (e.g., "g_d0_f1", "Helvetica-Bold") to StandardFonts key strings.
 */
export function mapPDFJsFontToStandard(pdfJsFontName: string): string {
  const name = pdfJsFontName.toLowerCase();

  if (name.includes('courier')) {
    if (name.includes('bold') && (name.includes('oblique') || name.includes('italic'))) return 'CourierBoldOblique';
    if (name.includes('bold')) return 'CourierBold';
    if (name.includes('oblique') || name.includes('italic')) return 'CourierOblique';
    return 'Courier';
  }

  if (name.includes('times')) {
    if (name.includes('bold') && name.includes('italic')) return 'TimesRomanBoldItalic';
    if (name.includes('bold')) return 'TimesRomanBold';
    if (name.includes('italic')) return 'TimesRomanItalic';
    return 'TimesRoman';
  }

  // Default to Helvetica
  if (name.includes('bold') && (name.includes('oblique') || name.includes('italic'))) return 'HelveticaBoldOblique';
  if (name.includes('bold')) return 'HelveticaBold';
  if (name.includes('oblique') || name.includes('italic')) return 'HelveticaOblique';
  return 'Helvetica';
}
