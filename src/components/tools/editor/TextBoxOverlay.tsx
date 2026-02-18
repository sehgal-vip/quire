import { useState, useRef, useCallback, useEffect } from 'react';
import { useEditorStore } from '@/stores/editorStore';
import type { TextBox } from '@/stores/editorStore';
import { pdfRectToScreen } from '@/lib/pdf-editor-utils';

interface TextBoxOverlayProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  viewport: any;
}

export function TextBoxOverlay({ viewport }: TextBoxOverlayProps) {
  const currentPage = useEditorStore((s) => s.currentPage);
  const textBoxes = useEditorStore((s) => s.textBoxes);
  const selectedTextBoxId = useEditorStore((s) => s.selectedTextBoxId);
  const setSelectedTextBoxId = useEditorStore((s) => s.setSelectedTextBoxId);
  const updateTextBox = useEditorStore((s) => s.updateTextBox);
  const removeTextBox = useEditorStore((s) => s.removeTextBox);
  const pushAction = useEditorStore((s) => s.pushAction);

  const pageBoxes = textBoxes.filter((tb) => tb.pageIndex === currentPage);

  return (
    <>
      {pageBoxes.map((tb) => (
        <TextBoxItem
          key={tb.id}
          textBox={tb}
          viewport={viewport}
          isSelected={tb.id === selectedTextBoxId}
          onSelect={() => setSelectedTextBoxId(tb.id)}
          onUpdate={(updates) => updateTextBox(tb.id, updates)}
          onDelete={() => removeTextBox(tb.id)}
          onPushAction={pushAction}
        />
      ))}
    </>
  );
}

interface TextBoxItemProps {
  textBox: TextBox;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  viewport: any;
  isSelected: boolean;
  onSelect: () => void;
  onUpdate: (updates: Partial<TextBox>) => void;
  onDelete: () => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onPushAction: (action: any) => void;
}

function TextBoxItem({ textBox, viewport, isSelected, onSelect, onUpdate, onPushAction }: TextBoxItemProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const dragStart = useRef({ x: 0, y: 0, tbX: 0, tbY: 0 });
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const screenRect = pdfRectToScreen(
    { x: textBox.x, y: textBox.y, width: textBox.width, height: textBox.height },
    viewport
  );

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onSelect();
    if (isEditing) return;

    setIsDragging(true);
    dragStart.current = { x: e.clientX, y: e.clientY, tbX: textBox.x, tbY: textBox.y };

    const handleMouseMove = (me: MouseEvent) => {
      const dx = (me.clientX - dragStart.current.x) / viewport.scale;
      const dy = -(me.clientY - dragStart.current.y) / viewport.scale; // Invert Y for PDF space

      onUpdate({
        x: dragStart.current.tbX + dx,
        y: dragStart.current.tbY + dy,
      });
    };

    const handleMouseUp = (me: MouseEvent) => {
      setIsDragging(false);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);

      const dx = (me.clientX - dragStart.current.x) / viewport.scale;
      const dy = -(me.clientY - dragStart.current.y) / viewport.scale;

      if (Math.abs(dx) > 1 || Math.abs(dy) > 1) {
        onPushAction({
          type: 'moveTextBox',
          id: textBox.id,
          fromX: dragStart.current.tbX,
          fromY: dragStart.current.tbY,
          toX: dragStart.current.tbX + dx,
          toY: dragStart.current.tbY + dy,
        });
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  }, [isEditing, onSelect, onUpdate, onPushAction, textBox.id, textBox.x, textBox.y, viewport.scale]);

  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditing(true);
    onSelect();
    setTimeout(() => textareaRef.current?.focus(), 0);
  }, [onSelect]);

  const handleTextChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const oldText = textBox.text;
    const newText = e.target.value;
    onUpdate({ text: newText });
    onPushAction({
      type: 'editTextBox',
      id: textBox.id,
      fromText: oldText,
      toText: newText,
    });
  }, [textBox.id, textBox.text, onUpdate, onPushAction]);

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isEditing]);

  const fontStyle: React.CSSProperties = {
    fontFamily: textBox.style.fontFamily === 'TimesRoman' ? 'Times New Roman, serif' :
                textBox.style.fontFamily === 'Courier' ? 'Courier New, monospace' : 'Helvetica, Arial, sans-serif',
    fontSize: textBox.style.fontSize * viewport.scale,
    fontWeight: textBox.style.bold ? 'bold' : 'normal',
    fontStyle: textBox.style.italic ? 'italic' : 'normal',
    color: textBox.style.color,
  };

  return (
    <div
      className={`absolute ${isDragging ? 'cursor-grabbing' : 'cursor-grab'} ${
        isSelected ? 'ring-2 ring-indigo-500 ring-offset-1' : 'hover:ring-2 hover:ring-indigo-300'
      }`}
      style={{
        left: screenRect.left,
        top: screenRect.top,
        width: screenRect.width,
        height: screenRect.height,
        minWidth: 40,
        minHeight: 20,
      }}
      onMouseDown={handleMouseDown}
      onDoubleClick={handleDoubleClick}
    >
      {isEditing ? (
        <textarea
          ref={textareaRef}
          value={textBox.text}
          onChange={handleTextChange}
          onBlur={() => setIsEditing(false)}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === 'Escape') setIsEditing(false);
          }}
          className="w-full h-full bg-white/80 dark:bg-gray-900/80 border-none outline-none resize-none p-1"
          style={fontStyle}
        />
      ) : (
        <div
          className="w-full h-full p-1 overflow-hidden bg-yellow-50/50 dark:bg-yellow-900/20 border border-yellow-300/50 dark:border-yellow-700/50 rounded-sm"
          style={fontStyle}
        >
          {textBox.text || <span className="text-gray-400 text-xs">Click to add text</span>}
        </div>
      )}

      {/* Resize handle */}
      {isSelected && !isEditing && (
        <div
          className="absolute -bottom-1.5 -right-1.5 w-3 h-3 bg-indigo-500 rounded-full cursor-se-resize"
          onMouseDown={(e) => {
            e.stopPropagation();
            const startX = e.clientX;
            const startY = e.clientY;
            const startW = textBox.width;
            const startH = textBox.height;

            const onMove = (me: MouseEvent) => {
              const dw = (me.clientX - startX) / viewport.scale;
              const dh = -(me.clientY - startY) / viewport.scale;
              onUpdate({
                width: Math.max(30, startW + dw),
                height: Math.max(15, startH + dh),
              });
            };

            const onUp = (me: MouseEvent) => {
              window.removeEventListener('mousemove', onMove);
              window.removeEventListener('mouseup', onUp);
              const dw = (me.clientX - startX) / viewport.scale;
              const dh = -(me.clientY - startY) / viewport.scale;
              onPushAction({
                type: 'resizeTextBox',
                id: textBox.id,
                fromWidth: startW,
                fromHeight: startH,
                toWidth: Math.max(30, startW + dw),
                toHeight: Math.max(15, startH + dh),
              });
            };

            window.addEventListener('mousemove', onMove);
            window.addEventListener('mouseup', onUp);
          }}
        />
      )}
    </div>
  );
}
