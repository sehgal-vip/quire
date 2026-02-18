import { create } from 'zustand';

export interface TextStyle {
  fontFamily: 'Helvetica' | 'Courier' | 'TimesRoman';
  fontSize: number;
  color: string;
  bold: boolean;
  italic: boolean;
}

export interface TextBox {
  id: string;
  pageIndex: number;
  x: number;
  y: number;
  width: number;
  height: number;
  text: string;
  style: TextStyle;
}

export interface TextEdit {
  id: string;
  pageIndex: number;
  x: number;
  y: number;
  width: number;
  height: number;
  originalText: string;
  newText: string;
  originalFontName: string;
  fontSize: number;
  coverColor: string;
}

export interface ExtractedTextItem {
  str: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontName: string;
  fontSize: number;
}

export type EditorAction =
  | { type: 'addTextBox'; textBox: TextBox }
  | { type: 'deleteTextBox'; textBox: TextBox }
  | { type: 'moveTextBox'; id: string; fromX: number; fromY: number; toX: number; toY: number }
  | { type: 'resizeTextBox'; id: string; fromWidth: number; fromHeight: number; toWidth: number; toHeight: number }
  | { type: 'editTextBox'; id: string; fromText: string; toText: string }
  | { type: 'editTextBoxStyle'; id: string; fromStyle: TextStyle; toStyle: TextStyle }
  | { type: 'addTextEdit'; textEdit: TextEdit }
  | { type: 'deleteTextEdit'; textEdit: TextEdit }
  | { type: 'modifyTextEdit'; id: string; fromText: string; toText: string };

export type EditorMode = 'form-fill' | 'add-text' | 'edit-text';

interface EditorState {
  mode: EditorMode;
  currentPage: number;
  zoom: number;
  textBoxes: TextBox[];
  textEdits: TextEdit[];
  hasFormFields: boolean;
  isDirty: boolean;
  selectedTextBoxId: string | null;
  textStyle: TextStyle;
  undoStack: EditorAction[];
  redoStack: EditorAction[];
  extractedText: Record<number, ExtractedTextItem[]>;
  pageRotations: Record<number, number>;

  // Actions
  setMode: (mode: EditorMode) => void;
  setCurrentPage: (page: number) => void;
  setZoom: (zoom: number) => void;
  setHasFormFields: (has: boolean) => void;
  setSelectedTextBoxId: (id: string | null) => void;
  setTextStyle: (style: Partial<TextStyle>) => void;
  setExtractedText: (pageIndex: number, items: ExtractedTextItem[]) => void;
  setPageRotations: (rotations: Record<number, number>) => void;
  addTextBox: (textBox: TextBox) => void;
  removeTextBox: (id: string) => void;
  updateTextBox: (id: string, updates: Partial<TextBox>) => void;
  addTextEdit: (textEdit: TextEdit) => void;
  removeTextEdit: (id: string) => void;
  updateTextEdit: (id: string, updates: Partial<TextEdit>) => void;
  pushAction: (action: EditorAction) => void;
  undo: () => void;
  redo: () => void;
  markDirty: () => void;
  reset: () => void;
}

const DEFAULT_TEXT_STYLE: TextStyle = {
  fontFamily: 'Helvetica',
  fontSize: 14,
  color: '#000000',
  bold: false,
  italic: false,
};

function clampZoom(z: number): number {
  return Math.min(3.0, Math.max(0.5, z));
}

function reverseAction(action: EditorAction): EditorAction {
  switch (action.type) {
    case 'addTextBox':
      return { type: 'deleteTextBox', textBox: action.textBox };
    case 'deleteTextBox':
      return { type: 'addTextBox', textBox: action.textBox };
    case 'moveTextBox':
      return { type: 'moveTextBox', id: action.id, fromX: action.toX, fromY: action.toY, toX: action.fromX, toY: action.fromY };
    case 'resizeTextBox':
      return { type: 'resizeTextBox', id: action.id, fromWidth: action.toWidth, fromHeight: action.toHeight, toWidth: action.fromWidth, toHeight: action.fromHeight };
    case 'editTextBox':
      return { type: 'editTextBox', id: action.id, fromText: action.toText, toText: action.fromText };
    case 'editTextBoxStyle':
      return { type: 'editTextBoxStyle', id: action.id, fromStyle: action.toStyle, toStyle: action.fromStyle };
    case 'addTextEdit':
      return { type: 'deleteTextEdit', textEdit: action.textEdit };
    case 'deleteTextEdit':
      return { type: 'addTextEdit', textEdit: action.textEdit };
    case 'modifyTextEdit':
      return { type: 'modifyTextEdit', id: action.id, fromText: action.toText, toText: action.fromText };
  }
}

function applyAction(state: EditorState, action: EditorAction): Partial<EditorState> {
  switch (action.type) {
    case 'addTextBox':
      return { textBoxes: [...state.textBoxes, action.textBox] };
    case 'deleteTextBox':
      return { textBoxes: state.textBoxes.filter(tb => tb.id !== action.textBox.id) };
    case 'moveTextBox':
      return {
        textBoxes: state.textBoxes.map(tb =>
          tb.id === action.id ? { ...tb, x: action.toX, y: action.toY } : tb
        ),
      };
    case 'resizeTextBox':
      return {
        textBoxes: state.textBoxes.map(tb =>
          tb.id === action.id ? { ...tb, width: action.toWidth, height: action.toHeight } : tb
        ),
      };
    case 'editTextBox':
      return {
        textBoxes: state.textBoxes.map(tb =>
          tb.id === action.id ? { ...tb, text: action.toText } : tb
        ),
      };
    case 'editTextBoxStyle':
      return {
        textBoxes: state.textBoxes.map(tb =>
          tb.id === action.id ? { ...tb, style: action.toStyle } : tb
        ),
      };
    case 'addTextEdit':
      return { textEdits: [...state.textEdits, action.textEdit] };
    case 'deleteTextEdit':
      return { textEdits: state.textEdits.filter(te => te.id !== action.textEdit.id) };
    case 'modifyTextEdit':
      return {
        textEdits: state.textEdits.map(te =>
          te.id === action.id ? { ...te, newText: action.toText } : te
        ),
      };
  }
}

export const useEditorStore = create<EditorState>((set, get) => ({
  mode: 'form-fill',
  currentPage: 0,
  zoom: 1.0,
  textBoxes: [],
  textEdits: [],
  hasFormFields: false,
  isDirty: false,
  selectedTextBoxId: null,
  textStyle: { ...DEFAULT_TEXT_STYLE },
  undoStack: [],
  redoStack: [],
  extractedText: {},
  pageRotations: {},

  setMode: (mode) => set({ mode, selectedTextBoxId: null }),
  setCurrentPage: (currentPage) => set({ currentPage, selectedTextBoxId: null }),
  setZoom: (zoom) => set({ zoom: clampZoom(zoom) }),
  setHasFormFields: (hasFormFields) => set({ hasFormFields }),
  setSelectedTextBoxId: (selectedTextBoxId) => set({ selectedTextBoxId }),
  setTextStyle: (partial) => set((s) => ({ textStyle: { ...s.textStyle, ...partial } })),
  setExtractedText: (pageIndex, items) => set((s) => ({
    extractedText: { ...s.extractedText, [pageIndex]: items },
  })),
  setPageRotations: (pageRotations) => set({ pageRotations }),

  addTextBox: (textBox) => {
    const state = get();
    set({
      textBoxes: [...state.textBoxes, textBox],
      isDirty: true,
      undoStack: [...state.undoStack, { type: 'addTextBox', textBox }],
      redoStack: [],
    });
  },

  removeTextBox: (id) => {
    const state = get();
    const textBox = state.textBoxes.find(tb => tb.id === id);
    if (!textBox) return;
    set({
      textBoxes: state.textBoxes.filter(tb => tb.id !== id),
      isDirty: true,
      selectedTextBoxId: state.selectedTextBoxId === id ? null : state.selectedTextBoxId,
      undoStack: [...state.undoStack, { type: 'deleteTextBox', textBox }],
      redoStack: [],
    });
  },

  updateTextBox: (id, updates) => {
    set((s) => ({
      textBoxes: s.textBoxes.map(tb => tb.id === id ? { ...tb, ...updates } : tb),
      isDirty: true,
    }));
  },

  addTextEdit: (textEdit) => {
    const state = get();
    set({
      textEdits: [...state.textEdits, textEdit],
      isDirty: true,
      undoStack: [...state.undoStack, { type: 'addTextEdit', textEdit }],
      redoStack: [],
    });
  },

  removeTextEdit: (id) => {
    const state = get();
    const textEdit = state.textEdits.find(te => te.id === id);
    if (!textEdit) return;
    set({
      textEdits: state.textEdits.filter(te => te.id !== id),
      isDirty: true,
      undoStack: [...state.undoStack, { type: 'deleteTextEdit', textEdit }],
      redoStack: [],
    });
  },

  updateTextEdit: (id, updates) => {
    set((s) => ({
      textEdits: s.textEdits.map(te => te.id === id ? { ...te, ...updates } : te),
      isDirty: true,
    }));
  },

  pushAction: (action) => {
    set((s) => ({
      undoStack: [...s.undoStack, action],
      redoStack: [],
      isDirty: true,
    }));
  },

  undo: () => {
    const state = get();
    if (state.undoStack.length === 0) return;
    const action = state.undoStack[state.undoStack.length - 1];
    const reversed = reverseAction(action);
    const changes = applyAction(state, reversed);
    set({
      ...changes,
      undoStack: state.undoStack.slice(0, -1),
      redoStack: [...state.redoStack, action],
      isDirty: true,
    });
  },

  redo: () => {
    const state = get();
    if (state.redoStack.length === 0) return;
    const action = state.redoStack[state.redoStack.length - 1];
    const changes = applyAction(state, action);
    set({
      ...changes,
      redoStack: state.redoStack.slice(0, -1),
      undoStack: [...state.undoStack, action],
      isDirty: true,
    });
  },

  markDirty: () => set({ isDirty: true }),

  reset: () => set({
    mode: 'form-fill',
    currentPage: 0,
    zoom: 1.0,
    textBoxes: [],
    textEdits: [],
    hasFormFields: false,
    isDirty: false,
    selectedTextBoxId: null,
    textStyle: { ...DEFAULT_TEXT_STYLE },
    undoStack: [],
    redoStack: [],
    extractedText: {},
    pageRotations: {},
  }),
}));
