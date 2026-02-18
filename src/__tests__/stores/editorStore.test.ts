import { useEditorStore } from '@/stores/editorStore';
import type { TextBox, TextEdit, EditorAction } from '@/stores/editorStore';

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
    expect(state.extractedText).toEqual({});
    expect(state.pageRotations).toEqual({});
  });

  it('sets mode and deselects text box', () => {
    const tb = makeTextBox('tb-1');
    useEditorStore.getState().addTextBox(tb);
    useEditorStore.getState().setSelectedTextBoxId('tb-1');
    useEditorStore.getState().setMode('add-text');
    expect(useEditorStore.getState().mode).toBe('add-text');
    expect(useEditorStore.getState().selectedTextBoxId).toBeNull();
  });

  it('sets current page and deselects text box', () => {
    useEditorStore.getState().setSelectedTextBoxId('any');
    useEditorStore.getState().setCurrentPage(3);
    expect(useEditorStore.getState().currentPage).toBe(3);
    expect(useEditorStore.getState().selectedTextBoxId).toBeNull();
  });

  describe('zoom clamping', () => {
    it('clamps to maximum 3.0', () => {
      useEditorStore.getState().setZoom(5.0);
      expect(useEditorStore.getState().zoom).toBe(3.0);
    });

    it('clamps to minimum 0.5', () => {
      useEditorStore.getState().setZoom(0.1);
      expect(useEditorStore.getState().zoom).toBe(0.5);
    });

    it('accepts valid zoom values', () => {
      useEditorStore.getState().setZoom(1.5);
      expect(useEditorStore.getState().zoom).toBe(1.5);
    });

    it('clamps exact boundaries', () => {
      useEditorStore.getState().setZoom(0.5);
      expect(useEditorStore.getState().zoom).toBe(0.5);
      useEditorStore.getState().setZoom(3.0);
      expect(useEditorStore.getState().zoom).toBe(3.0);
    });
  });

  describe('text boxes', () => {
    it('adds and removes text boxes', () => {
      const tb = makeTextBox('tb-1');
      useEditorStore.getState().addTextBox(tb);
      expect(useEditorStore.getState().textBoxes).toHaveLength(1);
      expect(useEditorStore.getState().isDirty).toBe(true);

      useEditorStore.getState().removeTextBox('tb-1');
      expect(useEditorStore.getState().textBoxes).toHaveLength(0);
    });

    it('addTextBox pushes to undo stack and clears redo', () => {
      const tb = makeTextBox('tb-1');
      useEditorStore.getState().addTextBox(tb);

      const state = useEditorStore.getState();
      expect(state.undoStack).toHaveLength(1);
      expect(state.undoStack[0].type).toBe('addTextBox');
      expect(state.redoStack).toHaveLength(0);
    });

    it('removeTextBox pushes to undo stack', () => {
      useEditorStore.getState().addTextBox(makeTextBox('tb-1'));
      useEditorStore.getState().removeTextBox('tb-1');

      const state = useEditorStore.getState();
      expect(state.undoStack).toHaveLength(2);
      expect(state.undoStack[1].type).toBe('deleteTextBox');
    });

    it('removeTextBox deselects if removed box was selected', () => {
      const tb = makeTextBox('tb-1');
      useEditorStore.getState().addTextBox(tb);
      useEditorStore.getState().setSelectedTextBoxId('tb-1');
      useEditorStore.getState().removeTextBox('tb-1');
      expect(useEditorStore.getState().selectedTextBoxId).toBeNull();
    });

    it('removeTextBox does not deselect other boxes', () => {
      useEditorStore.getState().addTextBox(makeTextBox('tb-1'));
      useEditorStore.getState().addTextBox(makeTextBox('tb-2'));
      useEditorStore.getState().setSelectedTextBoxId('tb-1');
      useEditorStore.getState().removeTextBox('tb-2');
      expect(useEditorStore.getState().selectedTextBoxId).toBe('tb-1');
    });

    it('removeTextBox ignores non-existent id', () => {
      useEditorStore.getState().addTextBox(makeTextBox('tb-1'));
      useEditorStore.getState().removeTextBox('non-existent');
      expect(useEditorStore.getState().textBoxes).toHaveLength(1);
      // Should not push to undo stack for missing id
      expect(useEditorStore.getState().undoStack).toHaveLength(1);
    });

    it('updateTextBox modifies specific properties', () => {
      useEditorStore.getState().addTextBox(makeTextBox('tb-1'));
      useEditorStore.getState().updateTextBox('tb-1', { text: 'Updated', x: 999 });

      const tb = useEditorStore.getState().textBoxes[0];
      expect(tb.text).toBe('Updated');
      expect(tb.x).toBe(999);
      expect(tb.y).toBe(200); // unchanged
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

    it('undo/redo moveTextBox preserves coordinates', () => {
      useEditorStore.getState().addTextBox(makeTextBox('tb-1'));
      useEditorStore.getState().pushAction({
        type: 'moveTextBox',
        id: 'tb-1',
        fromX: 100,
        fromY: 200,
        toX: 300,
        toY: 400,
      });
      useEditorStore.getState().updateTextBox('tb-1', { x: 300, y: 400 });

      useEditorStore.getState().undo();
      const tb = useEditorStore.getState().textBoxes[0];
      expect(tb.x).toBe(100);
      expect(tb.y).toBe(200);

      useEditorStore.getState().redo();
      const tb2 = useEditorStore.getState().textBoxes[0];
      expect(tb2.x).toBe(300);
      expect(tb2.y).toBe(400);
    });

    it('undo/redo resizeTextBox preserves y, width, and height', () => {
      useEditorStore.getState().addTextBox(makeTextBox('tb-1'));
      const resizeAction: EditorAction = {
        type: 'resizeTextBox',
        id: 'tb-1',
        fromY: 200,
        fromWidth: 150,
        fromHeight: 30,
        toY: 180,
        toWidth: 250,
        toHeight: 50,
      };
      useEditorStore.getState().pushAction(resizeAction);
      useEditorStore.getState().updateTextBox('tb-1', { y: 180, width: 250, height: 50 });

      // Verify applied state
      let tb = useEditorStore.getState().textBoxes[0];
      expect(tb.y).toBe(180);
      expect(tb.width).toBe(250);
      expect(tb.height).toBe(50);

      // Undo should restore original y, width, height
      useEditorStore.getState().undo();
      tb = useEditorStore.getState().textBoxes[0];
      expect(tb.y).toBe(200);
      expect(tb.width).toBe(150);
      expect(tb.height).toBe(30);

      // Redo should re-apply
      useEditorStore.getState().redo();
      tb = useEditorStore.getState().textBoxes[0];
      expect(tb.y).toBe(180);
      expect(tb.width).toBe(250);
      expect(tb.height).toBe(50);
    });

    it('undo/redo editTextBox preserves text', () => {
      useEditorStore.getState().addTextBox(makeTextBox('tb-1'));
      useEditorStore.getState().pushAction({
        type: 'editTextBox',
        id: 'tb-1',
        fromText: 'Test text',
        toText: 'New text',
      });
      useEditorStore.getState().updateTextBox('tb-1', { text: 'New text' });

      useEditorStore.getState().undo();
      expect(useEditorStore.getState().textBoxes[0].text).toBe('Test text');

      useEditorStore.getState().redo();
      expect(useEditorStore.getState().textBoxes[0].text).toBe('New text');
    });

    it('undo/redo editTextBoxStyle preserves style', () => {
      useEditorStore.getState().addTextBox(makeTextBox('tb-1'));
      const fromStyle = { fontFamily: 'Helvetica' as const, fontSize: 14, color: '#000000', bold: false, italic: false };
      const toStyle = { fontFamily: 'Courier' as const, fontSize: 20, color: '#FF0000', bold: true, italic: true };
      useEditorStore.getState().pushAction({
        type: 'editTextBoxStyle',
        id: 'tb-1',
        fromStyle,
        toStyle,
      });
      useEditorStore.getState().updateTextBox('tb-1', { style: toStyle });

      useEditorStore.getState().undo();
      expect(useEditorStore.getState().textBoxes[0].style).toEqual(fromStyle);

      useEditorStore.getState().redo();
      expect(useEditorStore.getState().textBoxes[0].style).toEqual(toStyle);
    });
  });

  describe('text edits', () => {
    it('adds and removes text edits', () => {
      const te = makeTextEdit('te-1');
      useEditorStore.getState().addTextEdit(te);
      expect(useEditorStore.getState().textEdits).toHaveLength(1);
      expect(useEditorStore.getState().isDirty).toBe(true);

      useEditorStore.getState().removeTextEdit('te-1');
      expect(useEditorStore.getState().textEdits).toHaveLength(0);
    });

    it('removeTextEdit ignores non-existent id', () => {
      useEditorStore.getState().addTextEdit(makeTextEdit('te-1'));
      useEditorStore.getState().removeTextEdit('non-existent');
      expect(useEditorStore.getState().textEdits).toHaveLength(1);
    });

    it('updateTextEdit modifies specific properties', () => {
      useEditorStore.getState().addTextEdit(makeTextEdit('te-1'));
      useEditorStore.getState().updateTextEdit('te-1', { newText: 'Changed' });
      expect(useEditorStore.getState().textEdits[0].newText).toBe('Changed');
      expect(useEditorStore.getState().textEdits[0].originalText).toBe('Original'); // unchanged
    });

    it('undo/redo add text edit', () => {
      useEditorStore.getState().addTextEdit(makeTextEdit('te-1'));

      useEditorStore.getState().undo();
      expect(useEditorStore.getState().textEdits).toHaveLength(0);

      useEditorStore.getState().redo();
      expect(useEditorStore.getState().textEdits).toHaveLength(1);
    });

    it('undo/redo remove text edit', () => {
      useEditorStore.getState().addTextEdit(makeTextEdit('te-1'));
      useEditorStore.getState().removeTextEdit('te-1');

      useEditorStore.getState().undo();
      expect(useEditorStore.getState().textEdits).toHaveLength(1);

      useEditorStore.getState().redo();
      expect(useEditorStore.getState().textEdits).toHaveLength(0);
    });

    it('undo/redo modifyTextEdit preserves text', () => {
      useEditorStore.getState().addTextEdit(makeTextEdit('te-1'));
      useEditorStore.getState().pushAction({
        type: 'modifyTextEdit',
        id: 'te-1',
        fromText: 'Edited',
        toText: 'Modified again',
      });
      useEditorStore.getState().updateTextEdit('te-1', { newText: 'Modified again' });

      useEditorStore.getState().undo();
      expect(useEditorStore.getState().textEdits[0].newText).toBe('Edited');

      useEditorStore.getState().redo();
      expect(useEditorStore.getState().textEdits[0].newText).toBe('Modified again');
    });
  });

  describe('cross-mode undo/redo', () => {
    it('undo stack is linear across text boxes and text edits', () => {
      useEditorStore.getState().addTextBox(makeTextBox('tb-1'));
      useEditorStore.getState().addTextEdit(makeTextEdit('te-1'));

      expect(useEditorStore.getState().undoStack).toHaveLength(2);
      expect(useEditorStore.getState().undoStack[0].type).toBe('addTextBox');
      expect(useEditorStore.getState().undoStack[1].type).toBe('addTextEdit');

      // Undo removes text edit first (LIFO)
      useEditorStore.getState().undo();
      expect(useEditorStore.getState().textEdits).toHaveLength(0);
      expect(useEditorStore.getState().textBoxes).toHaveLength(1);

      // Undo removes text box second
      useEditorStore.getState().undo();
      expect(useEditorStore.getState().textBoxes).toHaveLength(0);
    });

    it('multiple undo then redo restores everything', () => {
      useEditorStore.getState().addTextBox(makeTextBox('tb-1'));
      useEditorStore.getState().addTextEdit(makeTextEdit('te-1'));
      useEditorStore.getState().addTextBox(makeTextBox('tb-2'));

      // Undo all 3
      useEditorStore.getState().undo();
      useEditorStore.getState().undo();
      useEditorStore.getState().undo();
      expect(useEditorStore.getState().textBoxes).toHaveLength(0);
      expect(useEditorStore.getState().textEdits).toHaveLength(0);
      expect(useEditorStore.getState().redoStack).toHaveLength(3);

      // Redo all 3
      useEditorStore.getState().redo();
      useEditorStore.getState().redo();
      useEditorStore.getState().redo();
      expect(useEditorStore.getState().textBoxes).toHaveLength(2);
      expect(useEditorStore.getState().textEdits).toHaveLength(1);
      expect(useEditorStore.getState().redoStack).toHaveLength(0);
    });
  });

  describe('pushAction', () => {
    it('clears redo stack on new action', () => {
      const tb: TextBox = makeTextBox('tb-1');
      useEditorStore.getState().addTextBox(tb);
      useEditorStore.getState().undo();
      expect(useEditorStore.getState().redoStack).toHaveLength(1);

      // New action clears redo stack
      useEditorStore.getState().addTextBox(makeTextBox('tb-2'));
      expect(useEditorStore.getState().redoStack).toHaveLength(0);
    });

    it('marks dirty on push', () => {
      useEditorStore.getState().pushAction({
        type: 'moveTextBox',
        id: 'x',
        fromX: 0, fromY: 0, toX: 1, toY: 1,
      });
      expect(useEditorStore.getState().isDirty).toBe(true);
    });
  });

  describe('undo/redo edge cases', () => {
    it('undo with empty stack does nothing', () => {
      const before = useEditorStore.getState();
      useEditorStore.getState().undo();
      const after = useEditorStore.getState();
      expect(after.textBoxes).toEqual(before.textBoxes);
      expect(after.textEdits).toEqual(before.textEdits);
    });

    it('redo with empty stack does nothing', () => {
      const before = useEditorStore.getState();
      useEditorStore.getState().redo();
      const after = useEditorStore.getState();
      expect(after.textBoxes).toEqual(before.textBoxes);
      expect(after.textEdits).toEqual(before.textEdits);
    });
  });

  describe('setTextStyle', () => {
    it('partially updates text style', () => {
      useEditorStore.getState().setTextStyle({ bold: true, fontSize: 24 });
      const style = useEditorStore.getState().textStyle;
      expect(style.bold).toBe(true);
      expect(style.fontSize).toBe(24);
      expect(style.fontFamily).toBe('Helvetica'); // unchanged
      expect(style.italic).toBe(false); // unchanged
    });
  });

  describe('extractedText', () => {
    it('sets extracted text per page', () => {
      const items = [
        { str: 'Hello', x: 10, y: 20, width: 50, height: 12, fontName: 'Helvetica', fontSize: 12 },
      ];
      useEditorStore.getState().setExtractedText(0, items);
      expect(useEditorStore.getState().extractedText[0]).toEqual(items);
      expect(useEditorStore.getState().extractedText[1]).toBeUndefined();
    });

    it('does not overwrite other pages', () => {
      const items0 = [{ str: 'Page 0', x: 0, y: 0, width: 50, height: 12, fontName: 'H', fontSize: 12 }];
      const items1 = [{ str: 'Page 1', x: 0, y: 0, width: 50, height: 12, fontName: 'H', fontSize: 12 }];
      useEditorStore.getState().setExtractedText(0, items0);
      useEditorStore.getState().setExtractedText(1, items1);
      expect(useEditorStore.getState().extractedText[0]).toEqual(items0);
      expect(useEditorStore.getState().extractedText[1]).toEqual(items1);
    });
  });

  it('reset clears all state', () => {
    useEditorStore.getState().setMode('edit-text');
    useEditorStore.getState().setZoom(2.0);
    useEditorStore.getState().markDirty();
    useEditorStore.getState().addTextBox(makeTextBox('tb-1'));
    useEditorStore.getState().addTextEdit(makeTextEdit('te-1'));
    useEditorStore.getState().setExtractedText(0, []);
    useEditorStore.getState().setPageRotations({ 0: 90 });
    useEditorStore.getState().reset();

    const state = useEditorStore.getState();
    expect(state.mode).toBe('form-fill');
    expect(state.zoom).toBe(1.0);
    expect(state.isDirty).toBe(false);
    expect(state.undoStack).toHaveLength(0);
    expect(state.redoStack).toHaveLength(0);
    expect(state.textBoxes).toHaveLength(0);
    expect(state.textEdits).toHaveLength(0);
    expect(state.extractedText).toEqual({});
    expect(state.pageRotations).toEqual({});
  });
});

// Helpers

function makeTextBox(id: string): TextBox {
  return {
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
  };
}

function makeTextEdit(id: string): TextEdit {
  return {
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
  };
}
