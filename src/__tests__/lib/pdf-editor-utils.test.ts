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

  it('defaults to Helvetica for empty string', () => {
    expect(getStandardFont('', false, false)).toBe('Helvetica');
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

  it('is case-insensitive', () => {
    expect(mapPDFJsFontToStandard('HELVETICA-BOLD')).toBe('HelveticaBold');
    expect(mapPDFJsFontToStandard('courier-oblique')).toBe('CourierOblique');
    expect(mapPDFJsFontToStandard('TIMES-BOLDITALIC')).toBe('TimesRomanBoldItalic');
  });

  it('handles Courier italic via italic keyword', () => {
    expect(mapPDFJsFontToStandard('Courier-Italic')).toBe('CourierOblique');
    expect(mapPDFJsFontToStandard('Courier-BoldItalic')).toBe('CourierBoldOblique');
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

    it('top of page returns high PDF Y', () => {
      const vp = makeViewport(1.0);
      const result = screenToPDF(0, 0, { left: 0, top: 0 }, vp);
      expect(result.y).toBeCloseTo(842); // top of page in PDF
    });

    it('bottom of page returns low PDF Y', () => {
      const vp = makeViewport(1.0);
      const result = screenToPDF(0, 842, { left: 0, top: 0 }, vp);
      expect(result.y).toBeCloseTo(0); // bottom of page in PDF
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

    it('PDF origin (0,0) maps to bottom-left of screen', () => {
      const vp = makeViewport(1.0);
      const result = pdfToScreen(0, 0, vp);
      expect(result.x).toBeCloseTo(0);
      expect(result.y).toBeCloseTo(842); // bottom of canvas
    });

    it('high PDF Y maps to top of screen', () => {
      const vp = makeViewport(1.0);
      const result = pdfToScreen(0, 842, vp);
      expect(result.x).toBeCloseTo(0);
      expect(result.y).toBeCloseTo(0); // top of canvas
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

    it('rect at PDF origin has correct screen position', () => {
      const vp = makeViewport(1.0);
      const result = pdfRectToScreen({ x: 0, y: 0, width: 100, height: 50 }, vp);
      expect(result.left).toBeCloseTo(0);
      expect(result.top).toBeCloseTo(792); // 842 - 50
      expect(result.width).toBeCloseTo(100);
      expect(result.height).toBeCloseTo(50);
    });

    it('zero-height rect produces zero screen height', () => {
      const vp = makeViewport(1.0);
      const result = pdfRectToScreen({ x: 100, y: 500, width: 200, height: 0 }, vp);
      expect(result.height).toBeCloseTo(0);
    });

    it('round-trips coordinates at zoom 1.5', () => {
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

    it('round-trips at zoom 0.5', () => {
      const vp = makeViewport(0.5);
      const original = { x: 50, y: 100, width: 300, height: 80 };
      const screen = pdfRectToScreen(original, vp);

      const topLeftPdf = screenToPDF(screen.left, screen.top, { left: 0, top: 0 }, vp);
      const bottomRightPdf = screenToPDF(screen.left + screen.width, screen.top + screen.height, { left: 0, top: 0 }, vp);

      expect(topLeftPdf.x).toBeCloseTo(original.x);
      expect(topLeftPdf.y).toBeCloseTo(original.y + original.height);
      expect(bottomRightPdf.x).toBeCloseTo(original.x + original.width);
      expect(bottomRightPdf.y).toBeCloseTo(original.y);
    });

    it('round-trips at zoom 3.0', () => {
      const vp = makeViewport(3.0);
      const original = { x: 200, y: 600, width: 150, height: 40 };
      const screen = pdfRectToScreen(original, vp);

      const topLeftPdf = screenToPDF(screen.left, screen.top, { left: 0, top: 0 }, vp);
      const bottomRightPdf = screenToPDF(screen.left + screen.width, screen.top + screen.height, { left: 0, top: 0 }, vp);

      expect(topLeftPdf.x).toBeCloseTo(original.x);
      expect(topLeftPdf.y).toBeCloseTo(original.y + original.height);
      expect(bottomRightPdf.x).toBeCloseTo(original.x + original.width);
      expect(bottomRightPdf.y).toBeCloseTo(original.y);
    });
  });

  describe('text box positioning (bug regression)', () => {
    it('click at top of page: pdfY is large, box bottom (y) should be pdfY - height', () => {
      // When user clicks near top of page, screenToPDF returns high pdfY
      const vp = makeViewport(1.0);
      const clickResult = screenToPDF(100, 50, { left: 0, top: 0 }, vp);
      // pdfY should be near top of page (high value)
      expect(clickResult.y).toBeCloseTo(792);

      // Text box: y (bottom) = pdfY - height, so top = pdfY
      const boxHeight = 30;
      const boxY = clickResult.y - boxHeight; // 762
      const boxRect = pdfRectToScreen({ x: clickResult.x, y: boxY, width: 200, height: boxHeight }, vp);

      // Screen top of the box should be at the click y position
      expect(boxRect.top).toBeCloseTo(50);
    });

    it('click at middle of page: box appears at click point', () => {
      const vp = makeViewport(1.0);
      const clickResult = screenToPDF(200, 421, { left: 0, top: 0 }, vp);
      expect(clickResult.y).toBeCloseTo(421);

      const boxHeight = 30;
      const boxY = clickResult.y - boxHeight;
      const boxRect = pdfRectToScreen({ x: clickResult.x, y: boxY, width: 200, height: boxHeight }, vp);
      expect(boxRect.top).toBeCloseTo(421);
    });

    it('resize: increasing height while decreasing y keeps top edge fixed', () => {
      const vp = makeViewport(1.0);
      const original = { x: 100, y: 500, width: 200, height: 30 };
      const originalScreen = pdfRectToScreen(original, vp);

      // Simulate resize: drag down by 20 screen pixels at zoom 1
      const dh = 20;
      const resized = { x: 100, y: 500 - dh, width: 200, height: 30 + dh };
      const resizedScreen = pdfRectToScreen(resized, vp);

      // Top edge should not move
      expect(resizedScreen.top).toBeCloseTo(originalScreen.top);
      // Height should increase by 20 screen pixels
      expect(resizedScreen.height).toBeCloseTo(originalScreen.height + dh);
    });
  });
});
