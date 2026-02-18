import { useEffect, useRef, useCallback, useState } from 'react';
import { useEditorStore } from '@/stores/editorStore';
import type { TextBox } from '@/stores/editorStore';
import { TextBoxOverlay } from './TextBoxOverlay';
import { TextHighlightOverlay } from './TextHighlightOverlay';
import { screenToPDF } from '@/lib/pdf-editor-utils';

interface PDFEditorCanvasProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  pdfDoc: any;
  coverColor: string;
}

export function PDFEditorCanvas({ pdfDoc, coverColor }: PDFEditorCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const annotationLayerRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [viewport, setViewport] = useState<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [pdfPage, setPdfPage] = useState<any>(null);

  const mode = useEditorStore((s) => s.mode);
  const currentPage = useEditorStore((s) => s.currentPage);
  const zoom = useEditorStore((s) => s.zoom);
  const textStyle = useEditorStore((s) => s.textStyle);
  const addTextBox = useEditorStore((s) => s.addTextBox);
  const setSelectedTextBoxId = useEditorStore((s) => s.setSelectedTextBoxId);
  const markDirty = useEditorStore((s) => s.markDirty);

  // Render current page
  useEffect(() => {
    if (!pdfDoc || !canvasRef.current) return;

    let cancelled = false;

    const renderPage = async () => {
      try {
        const page = await pdfDoc.getPage(currentPage + 1); // PDF.js uses 1-indexed
        if (cancelled) return;

        const vp = page.getViewport({ scale: zoom });
        const canvas = canvasRef.current!;
        canvas.width = vp.width;
        canvas.height = vp.height;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        await page.render({ canvasContext: ctx, viewport: vp }).promise;

        setViewport(vp);
        setPdfPage(page);

        // Setup annotation layer for form fields
        if (annotationLayerRef.current) {
          try {
            const annotations = await page.getAnnotations();

            // Clear previous
            annotationLayerRef.current.innerHTML = '';

            if (annotations.length > 0) {
              annotationLayerRef.current.style.width = `${vp.width}px`;
              annotationLayerRef.current.style.height = `${vp.height}px`;

              // Render annotation layer using PDF.js AnnotationLayer
              const pdfjsLib = await import('pdfjs-dist');
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const AnnotationLayer = (pdfjsLib as any).AnnotationLayer;
              if (AnnotationLayer) {
                const annotationLayerParams = {
                  viewport: vp.clone({ dontFlip: true }),
                  div: annotationLayerRef.current,
                  annotations,
                  page,
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  annotationStorage: (pdfDoc as any).annotationStorage,
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  linkService: null as any,
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  downloadManager: null as any,
                  renderForms: true,
                };
                AnnotationLayer.render(annotationLayerParams);
              }
            }
          } catch {
            // Annotation layer render failed — still show the PDF
          }
        }
      } catch {
        // Page render failed
      }
    };

    renderPage();

    return () => {
      cancelled = true;
    };
  }, [pdfDoc, currentPage, zoom]);

  // Handle click on canvas to add text box
  const handleCanvasClick = useCallback((e: React.MouseEvent) => {
    if (mode !== 'add-text' || !viewport || !canvasRef.current) return;

    const canvasRect = canvasRef.current.getBoundingClientRect();
    const { x: pdfX, y: pdfY } = screenToPDF(e.clientX, e.clientY, canvasRect, viewport);

    const newTextBox: TextBox = {
      id: crypto.randomUUID(),
      pageIndex: currentPage,
      x: pdfX,
      y: pdfY,
      width: 200,
      height: 30,
      text: '',
      style: { ...textStyle },
    };

    addTextBox(newTextBox);
    setSelectedTextBoxId(newTextBox.id);
    markDirty();
  }, [mode, viewport, currentPage, textStyle, addTextBox, setSelectedTextBoxId, markDirty]);

  // Deselect on background click
  const handleBackgroundClick = useCallback((e: React.MouseEvent) => {
    if (e.target === containerRef.current) {
      setSelectedTextBoxId(null);
    }
  }, [setSelectedTextBoxId]);

  // Layer pointer-events based on mode
  const formLayerPointerEvents = mode === 'form-fill' ? 'auto' : 'none';
  const editOverlayPointerEvents = mode === 'form-fill' ? 'none' : 'auto';

  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-auto bg-gray-200 dark:bg-gray-800 flex items-start justify-center p-4"
      onClick={handleBackgroundClick}
    >
      <div className="relative inline-block shadow-xl">
        {/* Layer 1: PDF Canvas */}
        <canvas
          ref={canvasRef}
          className="block"
          style={{ zIndex: 10 }}
          onClick={handleCanvasClick}
        />

        {/* Layer 2: Annotation/Form layer */}
        <div
          ref={annotationLayerRef}
          className="annotationLayer absolute inset-0"
          style={{
            zIndex: 20,
            pointerEvents: formLayerPointerEvents,
          }}
        />

        {/* Layer 3: Edit overlay */}
        {viewport && (
          <div
            className="absolute inset-0"
            style={{
              zIndex: 30,
              pointerEvents: editOverlayPointerEvents,
            }}
          >
            {mode === 'add-text' && (
              <TextBoxOverlay viewport={viewport} />
            )}
            {mode === 'edit-text' && pdfPage && (
              <TextHighlightOverlay
                viewport={viewport}
                pdfPage={pdfPage}
                coverColor={coverColor}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
