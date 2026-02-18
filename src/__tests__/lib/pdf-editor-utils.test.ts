import { getStandardFont, mapPDFJsFontToStandard, pdfRectToScreen, pdfToScreen, screenToPDF } from '@/lib/pdf-editor-utils';

describe('getStandardFont', () => {
  it('returns Helvetica variants', () => {
    expect(getStandardFont('Helvetica', false, false)).toBe('Helvetica');
    expect(getStandardFont('Helvetica', true, false)).toBe('HelveticaBold');
    expect(getStandardFont('Helvetica', false, true)).toBe('HelveticaOblique');
    expect(getStandardFont('Helvetica', true, true)).toBe('HelveticaBoldOblique');
  });

  it('returns Courier variants', () => {
    expect(getStandardFont('Courier', false, false)).toBe('Courier');
    expect(getStandardFont('Courier', true, false)).toBe('CourierBold');
    expect(getStandardFont('Courier', false, true)).toBe('CourierOblique');
    expect(getStandardFont('Courier', true, true)).toBe('CourierBoldOblique');
  });

  it('returns TimesRoman variants', () => {
    expect(getStandardFont('TimesRoman', false, false)).toBe('TimesRoman');
    expect(getStandardFont('TimesRoman', true, false)).toBe('TimesRomanBold');
    expect(getStandardFont('TimesRoman', false, true)).toBe('TimesRomanItalic');
    expect(getStandardFont('TimesRoman', true, true)).toBe('TimesRomanBoldItalic');
  });

  it('defaults to Helvetica for unknown families', () => {
    expect(getStandardFont('Arial', false, false)).toBe('Helvetica');
    expect(getStandardFont('SomeFont', true, true)).toBe('HelveticaBoldOblique');
  });
});

describe('mapPDFJsFontToStandard', () => {
  it('maps Helvetica names correctly', () => {
    expect(mapPDFJsFontToStandard('Helvetica')).toBe('Helvetica');
    expect(mapPDFJsFontToStandard('Helvetica-Bold')).toBe('HelveticaBold');
    expect(mapPDFJsFontToStandard('Helvetica-Oblique')).toBe('HelveticaOblique');
    expect(mapPDFJsFontToStandard('Helvetica-BoldOblique')).toBe('HelveticaBoldOblique');
  });

  it('maps Courier names correctly', () => {
    expect(mapPDFJsFontToStandard('Courier')).toBe('Courier');
    expect(mapPDFJsFontToStandard('Courier-Bold')).toBe('CourierBold');
    expect(mapPDFJsFontToStandard('Courier-Oblique')).toBe('CourierOblique');
    expect(mapPDFJsFontToStandard('Courier-BoldOblique')).toBe('CourierBoldOblique');
  });

  it('maps Times names correctly', () => {
    expect(mapPDFJsFontToStandard('TimesNewRoman')).toBe('TimesRoman');
    expect(mapPDFJsFontToStandard('Times-Bold')).toBe('TimesRomanBold');
    expect(mapPDFJsFontToStandard('Times-Italic')).toBe('TimesRomanItalic');
    expect(mapPDFJsFontToStandard('Times-BoldItalic')).toBe('TimesRomanBoldItalic');
  });

  it('maps unknown PDF.js font names to Helvetica', () => {
    expect(mapPDFJsFontToStandard('g_d0_f1')).toBe('Helvetica');
    expect(mapPDFJsFontToStandard('ABCDEF+CustomFont')).toBe('Helvetica');
  });

  it('handles italic variant in unknown fonts', () => {
    expect(mapPDFJsFontToStandard('SomeFont-BoldItalic')).toBe('HelveticaBoldOblique');
    expect(mapPDFJsFontToStandard('SomeFont-Italic')).toBe('HelveticaOblique');
  });
});

describe('coordinate conversion', () => {
  // Mock viewport that does simple scaling
  function makeViewport(scale: number) {
    return {
      width: 595 * scale,
      height: 842 * scale,
      scale,
      convertToPdfPoint: (x: number, y: number) => [x / scale, (842 * scale - y) / scale] as [number, number],
      convertToViewportPoint: (x: number, y: number) => [x * scale, (842 - y) * scale] as [number, number],
    };
  }

  describe('screenToPDF', () => {
    it('converts at zoom 1.0', () => {
      const vp = makeViewport(1.0);
      const result = screenToPDF(100, 100, { left: 0, top: 0 }, vp);
      expect(result.x).toBeCloseTo(100);
      expect(result.y).toBeCloseTo(742); // 842 - 100
    });

    it('converts at zoom 2.0', () => {
      const vp = makeViewport(2.0);
      const result = screenToPDF(200, 200, { left: 0, top: 0 }, vp);
      expect(result.x).toBeCloseTo(100);
      expect(result.y).toBeCloseTo(742);
    });

    it('converts at zoom 0.5', () => {
      const vp = makeViewport(0.5);
      const result = screenToPDF(50, 50, { left: 0, top: 0 }, vp);
      expect(result.x).toBeCloseTo(100);
      expect(result.y).toBeCloseTo(742);
    });

    it('accounts for canvas offset', () => {
      const vp = makeViewport(1.0);
      const result = screenToPDF(150, 150, { left: 50, top: 50 }, vp);
      expect(result.x).toBeCloseTo(100);
      expect(result.y).toBeCloseTo(742);
    });
  });

  describe('pdfToScreen', () => {
    it('converts at zoom 1.0', () => {
      const vp = makeViewport(1.0);
      const result = pdfToScreen(100, 742, vp);
      expect(result.x).toBeCloseTo(100);
      expect(result.y).toBeCloseTo(100);
    });

    it('converts at zoom 2.0', () => {
      const vp = makeViewport(2.0);
      const result = pdfToScreen(100, 742, vp);
      expect(result.x).toBeCloseTo(200);
      expect(result.y).toBeCloseTo(200);
    });
  });

  describe('pdfRectToScreen', () => {
    it('converts a rect at zoom 1.0', () => {
      const vp = makeViewport(1.0);
      const result = pdfRectToScreen({ x: 100, y: 700, width: 200, height: 50 }, vp);
      expect(result.left).toBeCloseTo(100);
      expect(result.top).toBeCloseTo(92); // (842-750)*1
      expect(result.width).toBeCloseTo(200);
      expect(result.height).toBeCloseTo(50);
    });

    it('scales rect at zoom 2.0', () => {
      const vp = makeViewport(2.0);
      const result = pdfRectToScreen({ x: 100, y: 700, width: 200, height: 50 }, vp);
      expect(result.left).toBeCloseTo(200);
      expect(result.top).toBeCloseTo(184);
      expect(result.width).toBeCloseTo(400);
      expect(result.height).toBeCloseTo(100);
    });

    it('round-trips coordinates', () => {
      const vp = makeViewport(1.5);
      const original = { x: 150, y: 500, width: 100, height: 30 };
      const screen = pdfRectToScreen(original, vp);

      // Convert back to PDF
      const topLeftPdf = screenToPDF(screen.left, screen.top, { left: 0, top: 0 }, vp);
      const bottomRightPdf = screenToPDF(screen.left + screen.width, screen.top + screen.height, { left: 0, top: 0 }, vp);

      expect(topLeftPdf.x).toBeCloseTo(original.x);
      expect(topLeftPdf.y).toBeCloseTo(original.y + original.height);
      expect(bottomRightPdf.x).toBeCloseTo(original.x + original.width);
      expect(bottomRightPdf.y).toBeCloseTo(original.y);
    });
  });
});
