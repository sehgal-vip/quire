import { useState, useCallback, useEffect, useRef } from 'react';
import type { ToolOutput } from '@/types';
import { workerClient } from '@/lib/pdf-worker-client';
import { useProcessingStore } from '@/stores/processingStore';
import { useEditorStore } from '@/stores/editorStore';
import { FileDropZone } from '@/components/common/FileDropZone';
import { PreviewPanel } from '@/components/common/PreviewPanel';
import { DownloadPanel } from '@/components/common/DownloadPanel';
import { EditorToolbar } from './editor/EditorToolbar';
import { EditorSidebar } from './editor/EditorSidebar';
import { PDFEditorCanvas } from './editor/PDFEditorCanvas';
import { EditorBottomBar } from './editor/EditorBottomBar';
import { ERRORS } from '@/lib/error-messages';
import type { UploadedFile } from '@/types';
import toast from 'react-hot-toast';

export function EditPDFTool() {
  const [, setFile] = useState<UploadedFile | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [pdfBytes, setPdfBytes] = useState<Uint8Array | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [result, setResult] = useState<ToolOutput | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [coverColor, setCoverColor] = useState('#FFFFFF');
  const editorRef = useRef<HTMLDivElement>(null);

  const isDirty = useEditorStore((s) => s.isDirty);
  const mode = useEditorStore((s) => s.mode);
  const reset = useEditorStore((s) => s.reset);

  // Load PDF when file is selected
  const handleFilesLoaded = useCallback(async (files: UploadedFile[]) => {
    const f = files[0];
    if (!f) return;
    setFile(f);
    setPdfBytes(f.bytes);

    try {
      const pdfjsLib = await import('pdfjs-dist');
      const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(f.bytes) });
      const doc = await loadingTask.promise;
      setPdfDoc(doc);

      // Check for form fields
      const page1 = await doc.getPage(1);
      const annotations = await page1.getAnnotations();
      const hasForm = annotations.some(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (a: any) => a.subtype === 'Widget'
      );

      // Cache page rotations
      const rotations: Record<number, number> = {};
      for (let i = 1; i <= doc.numPages; i++) {
        const p = await doc.getPage(i);
        rotations[i - 1] = p.rotate;
      }

      useEditorStore.getState().reset();
      useEditorStore.getState().setHasFormFields(hasForm);
      useEditorStore.getState().setPageRotations(rotations);

      if (hasForm) {
        useEditorStore.getState().setMode('form-fill');
      } else {
        useEditorStore.getState().setMode('add-text');
      }

      setIsEditing(true);
    } catch (err) {
      toast.error('Failed to load PDF for editing');
      console.error(err);
    }
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    if (!isEditing) return;

    const handler = (e: KeyboardEvent) => {
      const isMod = e.metaKey || e.ctrlKey;

      if (isMod && e.key === 'z' && !e.shiftKey) {
        e.stopPropagation();
        e.preventDefault();
        useEditorStore.getState().undo();
        return;
      }
      if (isMod && (e.key === 'z' && e.shiftKey || e.key === 'Z')) {
        e.stopPropagation();
        e.preventDefault();
        useEditorStore.getState().redo();
        return;
      }
      if (e.key === 'Delete' || (e.key === 'Backspace' && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement))) {
        const state = useEditorStore.getState();
        if (state.mode === 'add-text' && state.selectedTextBoxId) {
          e.stopPropagation();
          state.removeTextBox(state.selectedTextBoxId);
          return;
        }
      }
      if (e.key === 'Escape') {
        e.stopPropagation();
        useEditorStore.getState().setSelectedTextBoxId(null);
      }
    };

    const el = editorRef.current;
    el?.addEventListener('keydown', handler, true);
    return () => el?.removeEventListener('keydown', handler, true);
  }, [isEditing]);

  // Unsaved changes guard
  useEffect(() => {
    if (!isDirty) return;

    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

  // Save flow
  const handleSave = useCallback(async () => {
    if (!pdfBytes || !pdfDoc) return;
    setIsSaving(true);

    try {
      const state = useEditorStore.getState();
      let currentBytes = pdfBytes;

      // Phase 1: If form fields modified, use PDF.js saveDocument
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const storage = (pdfDoc as any).annotationStorage;
        if (storage && storage.size > 0) {
          const savedData = await pdfDoc.saveDocument();
          currentBytes = new Uint8Array(savedData);
        }
      } catch {
        // saveDocument not available or failed — continue with original bytes
      }

      // Phase 2: Apply text edits via worker
      if (state.textBoxes.length > 0 || state.textEdits.length > 0 || state.hasFormFields) {
        const output = await workerClient.process('edit-pdf', [currentBytes], {
          textBoxes: state.textBoxes,
          textEdits: state.textEdits,
          flattenForm: false,
        });
        setResult(output);
      } else {
        // No edits — just return the form-filled version
        setResult({
          files: [{
            name: 'edited.pdf',
            bytes: currentBytes,
            pageCount: pdfDoc.numPages,
          }],
          processingTime: 0,
        });
      }

      useEditorStore.getState().reset();
      setIsEditing(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      toast.error(`Save failed: ${message}`);
    } finally {
      setIsSaving(false);
    }
  }, [pdfBytes, pdfDoc]);

  const handleBack = useCallback(() => {
    if (isDirty) {
      const confirmed = window.confirm(ERRORS.UNSAVED_CHANGES);
      if (!confirmed) return;
    }
    reset();
    setIsEditing(false);
    setFile(null);
    setPdfDoc(null);
    setPdfBytes(null);
  }, [isDirty, reset]);

  const handleReset = useCallback(() => {
    reset();
    setFile(null);
    setPdfDoc(null);
    setPdfBytes(null);
    setIsEditing(false);
    setResult(null);
    useProcessingStore.getState().reset();
  }, [reset]);

  // Result state
  if (result) {
    return (
      <div className="space-y-4">
        <PreviewPanel result={result} />
        <DownloadPanel result={result} onReset={handleReset} />
      </div>
    );
  }

  // Editor state — full-screen overlay
  if (isEditing && pdfDoc) {
    return (
      <div
        ref={editorRef}
        className="fixed inset-0 z-50 bg-white dark:bg-gray-900 flex flex-col"
        tabIndex={-1}
      >
        <EditorToolbar
          onBack={handleBack}
          onSave={handleSave}
          isSaving={isSaving}
        />

        {/* Cover color picker for Edit Text mode */}
        {mode === 'edit-text' && (
          <div className="flex-none bg-gray-50 dark:bg-gray-850 border-b border-gray-200 dark:border-gray-700 px-4 py-1.5 flex items-center gap-2">
            <span className="text-xs text-gray-500 dark:text-gray-400">Cover color:</span>
            <input
              type="color"
              value={coverColor}
              onChange={(e) => setCoverColor(e.target.value)}
              className="w-6 h-6 rounded border border-gray-300 dark:border-gray-600 cursor-pointer"
            />
            <span className="text-[10px] text-gray-400 dark:text-gray-500">{coverColor}</span>
          </div>
        )}

        <div className="flex flex-1 min-h-0">
          <EditorSidebar
            pdfDoc={pdfDoc}
            collapsed={sidebarCollapsed}
            onToggle={() => setSidebarCollapsed((s) => !s)}
          />
          <PDFEditorCanvas
            pdfDoc={pdfDoc}
            coverColor={coverColor}
          />
        </div>

        <EditorBottomBar totalPages={pdfDoc.numPages} />
      </div>
    );
  }

  // Upload state
  return (
    <div className="space-y-6">
      <FileDropZone onFilesLoaded={handleFilesLoaded} />
    </div>
  );
}
