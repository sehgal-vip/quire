import { useEditorStore } from '@/stores/editorStore';
import type { TextBox, TextEdit } from '@/stores/editorStore';

describe('editorStore', () => {
  beforeEach(() => {
    useEditorStore.getState().reset();
  });

  it('has correct initial state', () => {
    const state = useEditorStore.getState();
    expect(state.mode).toBe('form-fill');
    expect(state.currentPage).toBe(0);
    expect(state.zoom).toBe(1.0);
    expect(state.textBoxes).toHaveLength(0);
    expect(state.textEdits).toHaveLength(0);
    expect(state.hasFormFields).toBe(false);
    expect(state.isDirty).toBe(false);
    expect(state.selectedTextBoxId).toBeNull();
    expect(state.undoStack).toHaveLength(0);
    expect(state.redoStack).toHaveLength(0);
  });

  it('sets mode', () => {
    useEditorStore.getState().setMode('add-text');
    expect(useEditorStore.getState().mode).toBe('add-text');
  });

  it('clamps zoom to valid range', () => {
    useEditorStore.getState().setZoom(5.0);
    expect(useEditorStore.getState().zoom).toBe(3.0);

    useEditorStore.getState().setZoom(0.1);
    expect(useEditorStore.getState().zoom).toBe(0.5);

    useEditorStore.getState().setZoom(1.5);
    expect(useEditorStore.getState().zoom).toBe(1.5);
  });

  describe('text boxes', () => {
    const makeTextBox = (id: string): TextBox => ({
      id,
      pageIndex: 0,
      x: 100,
      y: 200,
      width: 150,
      height: 30,
      text: 'Test text',
      style: {
        fontFamily: 'Helvetica',
        fontSize: 14,
        color: '#000000',
        bold: false,
        italic: false,
      },
    });

    it('adds and removes text boxes', () => {
      const tb = makeTextBox('tb-1');
      useEditorStore.getState().addTextBox(tb);
      expect(useEditorStore.getState().textBoxes).toHaveLength(1);
      expect(useEditorStore.getState().isDirty).toBe(true);

      useEditorStore.getState().removeTextBox('tb-1');
      expect(useEditorStore.getState().textBoxes).toHaveLength(0);
    });

    it('undo/redo add text box', () => {
      const tb = makeTextBox('tb-1');
      useEditorStore.getState().addTextBox(tb);
      expect(useEditorStore.getState().textBoxes).toHaveLength(1);

      useEditorStore.getState().undo();
      expect(useEditorStore.getState().textBoxes).toHaveLength(0);

      useEditorStore.getState().redo();
      expect(useEditorStore.getState().textBoxes).toHaveLength(1);
    });

    it('undo/redo remove text box', () => {
      const tb = makeTextBox('tb-1');
      useEditorStore.getState().addTextBox(tb);
      useEditorStore.getState().removeTextBox('tb-1');
      expect(useEditorStore.getState().textBoxes).toHaveLength(0);

      useEditorStore.getState().undo();
      expect(useEditorStore.getState().textBoxes).toHaveLength(1);

      useEditorStore.getState().redo();
      expect(useEditorStore.getState().textBoxes).toHaveLength(0);
    });
  });

  describe('text edits', () => {
    const makeTextEdit = (id: string): TextEdit => ({
      id,
      pageIndex: 0,
      x: 50,
      y: 100,
      width: 200,
      height: 20,
      originalText: 'Original',
      newText: 'Edited',
      originalFontName: 'Helvetica',
      fontSize: 12,
      coverColor: '#FFFFFF',
    });

    it('adds and removes text edits', () => {
      const te = makeTextEdit('te-1');
      useEditorStore.getState().addTextEdit(te);
      expect(useEditorStore.getState().textEdits).toHaveLength(1);

      useEditorStore.getState().removeTextEdit('te-1');
      expect(useEditorStore.getState().textEdits).toHaveLength(0);
    });

    it('undo/redo text edits', () => {
      const te = makeTextEdit('te-1');
      useEditorStore.getState().addTextEdit(te);

      useEditorStore.getState().undo();
      expect(useEditorStore.getState().textEdits).toHaveLength(0);

      useEditorStore.getState().redo();
      expect(useEditorStore.getState().textEdits).toHaveLength(1);
    });
  });

  it('reset clears all state', () => {
    useEditorStore.getState().setMode('edit-text');
    useEditorStore.getState().setZoom(2.0);
    useEditorStore.getState().markDirty();
    useEditorStore.getState().reset();

    const state = useEditorStore.getState();
    expect(state.mode).toBe('form-fill');
    expect(state.zoom).toBe(1.0);
    expect(state.isDirty).toBe(false);
    expect(state.undoStack).toHaveLength(0);
    expect(state.redoStack).toHaveLength(0);
  });

  it('pushAction clears redo stack', () => {
    const tb: TextBox = {
      id: 'tb-1',
      pageIndex: 0, x: 0, y: 0, width: 100, height: 20,
      text: 'Test',
      style: { fontFamily: 'Helvetica', fontSize: 14, color: '#000000', bold: false, italic: false },
    };
    useEditorStore.getState().addTextBox(tb);
    useEditorStore.getState().undo();
    expect(useEditorStore.getState().redoStack).toHaveLength(1);

    // New action clears redo stack
    const tb2: TextBox = { ...tb, id: 'tb-2' };
    useEditorStore.getState().addTextBox(tb2);
    expect(useEditorStore.getState().redoStack).toHaveLength(0);
  });
});
