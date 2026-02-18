import { useEditorStore } from '@/stores/editorStore';
import type { EditorMode } from '@/stores/editorStore';
import { ArrowLeft, ZoomIn, ZoomOut, Undo2, Redo2, Save } from 'lucide-react';

interface EditorToolbarProps {
  onBack: () => void;
  onSave: () => void;
  isSaving: boolean;
}

export function EditorToolbar({ onBack, onSave, isSaving }: EditorToolbarProps) {
  const mode = useEditorStore((s) => s.mode);
  const setMode = useEditorStore((s) => s.setMode);
  const zoom = useEditorStore((s) => s.zoom);
  const setZoom = useEditorStore((s) => s.setZoom);
  const hasFormFields = useEditorStore((s) => s.hasFormFields);
  const isDirty = useEditorStore((s) => s.isDirty);
  const undoStack = useEditorStore((s) => s.undoStack);
  const redoStack = useEditorStore((s) => s.redoStack);
  const undo = useEditorStore((s) => s.undo);
  const redo = useEditorStore((s) => s.redo);
  const textStyle = useEditorStore((s) => s.textStyle);
  const setTextStyle = useEditorStore((s) => s.setTextStyle);

  const modes: { id: EditorMode; label: string }[] = [
    ...(hasFormFields ? [{ id: 'form-fill' as EditorMode, label: 'Form Fill' }] : []),
    { id: 'add-text', label: 'Add Text' },
    { id: 'edit-text', label: 'Edit Text' },
  ];

  return (
    <div className="flex-none bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 px-4 py-2">
      <div className="flex items-center gap-3 flex-wrap">
        {/* Back button */}
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
        >
          <ArrowLeft size={16} />
          Back
        </button>

        <div className="w-px h-6 bg-gray-200 dark:bg-gray-700" />

        {/* Mode tabs */}
        <div className="flex rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          {modes.map((m) => (
            <button
              key={m.id}
              onClick={() => setMode(m.id)}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                mode === m.id
                  ? 'bg-indigo-600 text-white'
                  : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-750'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>

        <div className="w-px h-6 bg-gray-200 dark:bg-gray-700" />

        {/* Font controls (Add Text and Edit Text modes) */}
        {(mode === 'add-text') && (
          <div className="flex items-center gap-2">
            <select
              value={textStyle.fontFamily}
              onChange={(e) => setTextStyle({ fontFamily: e.target.value as 'Helvetica' | 'Courier' | 'TimesRoman' })}
              className="px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded"
            >
              <option value="Helvetica">Helvetica</option>
              <option value="Courier">Courier</option>
              <option value="TimesRoman">Times Roman</option>
            </select>

            <input
              type="number"
              min={6}
              max={72}
              value={textStyle.fontSize}
              onChange={(e) => setTextStyle({ fontSize: Number(e.target.value) })}
              className="w-14 px-1 py-1 text-xs border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded text-center"
            />

            <input
              type="color"
              value={textStyle.color}
              onChange={(e) => setTextStyle({ color: e.target.value })}
              className="w-6 h-6 rounded border border-gray-300 dark:border-gray-600 cursor-pointer"
            />

            <button
              onClick={() => setTextStyle({ bold: !textStyle.bold })}
              className={`w-7 h-7 flex items-center justify-center text-xs font-bold rounded border transition-colors ${
                textStyle.bold
                  ? 'bg-indigo-100 dark:bg-indigo-900 border-indigo-300 dark:border-indigo-700 text-indigo-700 dark:text-indigo-300'
                  : 'border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
              }`}
            >
              B
            </button>

            <button
              onClick={() => setTextStyle({ italic: !textStyle.italic })}
              className={`w-7 h-7 flex items-center justify-center text-xs italic rounded border transition-colors ${
                textStyle.italic
                  ? 'bg-indigo-100 dark:bg-indigo-900 border-indigo-300 dark:border-indigo-700 text-indigo-700 dark:text-indigo-300'
                  : 'border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
              }`}
            >
              I
            </button>

            <div className="w-px h-6 bg-gray-200 dark:bg-gray-700" />
          </div>
        )}

        {/* Zoom controls */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => setZoom(zoom - 0.25)}
            disabled={zoom <= 0.5}
            className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-30"
          >
            <ZoomOut size={14} />
          </button>
          <span className="text-xs text-gray-600 dark:text-gray-400 w-10 text-center">
            {Math.round(zoom * 100)}%
          </span>
          <button
            onClick={() => setZoom(zoom + 0.25)}
            disabled={zoom >= 3.0}
            className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-30"
          >
            <ZoomIn size={14} />
          </button>
        </div>

        <div className="w-px h-6 bg-gray-200 dark:bg-gray-700" />

        {/* Undo/Redo */}
        <div className="flex items-center gap-1">
          <button
            onClick={undo}
            disabled={undoStack.length === 0}
            className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-30"
            title="Undo (Ctrl+Z)"
          >
            <Undo2 size={14} />
          </button>
          <button
            onClick={redo}
            disabled={redoStack.length === 0}
            className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-30"
            title="Redo (Ctrl+Shift+Z)"
          >
            <Redo2 size={14} />
          </button>
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Save button */}
        <button
          onClick={onSave}
          disabled={!isDirty || isSaving}
          className="flex items-center gap-1.5 px-4 py-1.5 text-sm font-medium bg-indigo-600 dark:bg-indigo-500 text-white rounded-lg hover:bg-indigo-700 dark:hover:bg-indigo-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Save size={14} />
          {isSaving ? 'Saving...' : 'Save'}
        </button>
      </div>
    </div>
  );
}
