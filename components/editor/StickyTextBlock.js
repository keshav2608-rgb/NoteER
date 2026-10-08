'use client';
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNotebookStore } from '@/lib/store/useNotebookStore';
import {
  Trash2,
  Move,
  Plus,
  Minus,
  Bold,
  Italic,
  AlignLeft,
  AlignCenter,
  GripVertical,
  Check
} from 'lucide-react';

// Flat paper sticky notes. `bg`/`darkBg` are the note paper; text colours keep
// enough contrast on each.
const NOTE_STYLES = [
  { id: 'yellow', label: 'Yellow', swatch: '#fff1a8', bg: '#fff1a8', darkBg: '#e3d58c', defaultText: '#3b3410', darkText: '#2e290c' },
  { id: 'blue', label: 'Blue', swatch: '#cfe6ff', bg: '#cfe6ff', darkBg: '#b3c9e0', defaultText: '#0e2a44', darkText: '#0e2a44' },
  { id: 'green', label: 'Green', swatch: '#cdeed6', bg: '#cdeed6', darkBg: '#b2d2ba', defaultText: '#12382a', darkText: '#12382a' },
  { id: 'purple', label: 'Lilac', swatch: '#e4d9ff', bg: '#e4d9ff', darkBg: '#c8bde2', defaultText: '#2a1f4d', darkText: '#2a1f4d' },
  { id: 'pink', label: 'Pink', swatch: '#ffd5dd', bg: '#ffd5dd', darkBg: '#e0bac2', defaultText: '#4a1424', darkText: '#4a1424' },
  { id: 'card', label: 'Index card', swatch: '#ffffff', bg: '#ffffff', darkBg: '#2c3036', defaultText: '#23262a', darkText: '#e8e9e4' },
  { id: 'transparent', label: 'No paper', swatch: 'transparent', bg: 'transparent', darkBg: 'transparent', defaultText: '#23262a', darkText: '#e8e9e4' }
];

const HL_RADIUS = { borderRadius: '3px 9px 4px 10px / 9px 4px 10px 3px' };
const NOTE_BTN = 'inline-flex items-center justify-center w-9 h-9 sm:w-8 sm:h-8 rounded-ctl text-ink/75 hover:text-ink hover:bg-paper-2 transition-colors cursor-pointer shrink-0';
const NOTE_BTN_ON = 'inline-flex items-center justify-center w-9 h-9 sm:w-8 sm:h-8 bg-highlight text-highlight-fg cursor-pointer shrink-0';

export default function StickyTextBlock({
  block,
  onUpdate,
  onDelete,
  zoom = 1,
  panX = 0,
  panY = 0,
  isDarkModeOverride,
  canEditOverride,
  toolOverride,
  autoFocus = false
}) {
  const storeState = useNotebookStore();
  const canEdit = canEditOverride !== undefined ? canEditOverride : storeState.canEdit;
  const darkMode = isDarkModeOverride !== undefined ? isDarkModeOverride : storeState.darkMode;
  const currentTool = toolOverride !== undefined ? toolOverride : storeState.tool;
  const isPanMode = currentTool === 'pan' || currentTool === 'hand';

  const [localText, setLocalText] = useState(block.text || '');
  const [isFocused, setIsFocused] = useState(Boolean(autoFocus));
  const [isHovered, setIsHovered] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);

  const containerRef = useRef(null);
  const textareaRef = useRef(null);
  const dragStartRef = useRef({ startX: 0, startY: 0, initialBlockX: block.x, initialBlockY: block.y });
  const resizeStartRef = useRef({ startX: 0, initialWidth: block.width || 320 });
  const debounceTimerRef = useRef(null);
  const localTextRef = useRef(localText);
  localTextRef.current = localText;
  const isInteractingWithControlsRef = useRef(false);

  // Auto-focus on initial placement
  useEffect(() => {
    if (autoFocus && textareaRef.current) {
      const t = setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.focus();
          const len = textareaRef.current.value.length;
          textareaRef.current.setSelectionRange(len, len);
          setIsFocused(true);
        }
      }, 50);
      return () => clearTimeout(t);
    }
  }, [autoFocus]);

  // Sync text updates from remote peers when local user is NOT editing
  useEffect(() => {
    if (!isFocused && block.text !== undefined && block.text !== localTextRef.current) {
      setLocalText(block.text || '');
    }
  }, [block.text, isFocused]);

  // Clean up debounce timer
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  // Auto-grow textarea height
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.max(42, textareaRef.current.scrollHeight)}px`;
    }
  }, [localText, block.fontSize, block.width]);

  const handleTextChange = (e) => {
    const val = e.target.value;
    setLocalText(val);

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(() => {
      onUpdate({ ...block, text: val });
    }, 200);
  };

  // Robust blur handler: NEVER deletes the block if user is clicking on toolbar buttons or color swatches
  const handleBlur = (e) => {
    if (isDragging || isResizing || isInteractingWithControlsRef.current) return;
    if (containerRef.current && e?.relatedTarget && containerRef.current.contains(e.relatedTarget)) {
      return;
    }

    // 150ms grace period so clicks on formatting bar, palette swatches, or move handle don't trigger deletion
    setTimeout(() => {
      if (isInteractingWithControlsRef.current) return;
      if (document.activeElement && containerRef.current?.contains(document.activeElement)) {
        return;
      }

      setIsFocused(false);
      setShowColorPicker(false);

      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }

      // Auto-clean empty notes only if focus has truly exited to canvas
      if (!localTextRef.current || !localTextRef.current.trim()) {
        if (onDelete) {
          onDelete(block.id);
        }
        return;
      }

      if (localTextRef.current !== block.text) {
        onUpdate({ ...block, text: localTextRef.current });
      }
    }, 150);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      textareaRef.current?.blur();
      setIsFocused(false);
      setShowColorPicker(false);
    }
    // Tab key inserts 2 spaces without losing focus
    if (e.key === 'Tab') {
      e.preventDefault();
      const ta = textareaRef.current;
      if (!ta) return;
      const start = ta.selectionStart;
      const end = ta.selectionEnd;
      const updated = localText.substring(0, start) + '  ' + localText.substring(end);
      setLocalText(updated);
      setTimeout(() => {
        ta.selectionStart = ta.selectionEnd = start + 2;
      }, 0);
      onUpdate({ ...block, text: updated });
    }
    if ((e.key === 'Backspace' || e.key === 'Delete') && !localText && onDelete) {
      onDelete(block.id);
    }
  };

  // Drag movement
  const handleDragPointerDown = (e) => {
    if (!canEdit) return;
    e.stopPropagation();
    e.preventDefault();
    isInteractingWithControlsRef.current = true;
    try {
      e.target.setPointerCapture?.(e.pointerId);
    } catch (_) {}
    setIsDragging(true);
    dragStartRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initialBlockX: block.x,
      initialBlockY: block.y
    };
  };

  const handleDragPointerMove = (e) => {
    if (!isDragging) return;
    e.stopPropagation();
    e.preventDefault();
    const dx = (e.clientX - dragStartRef.current.startX) / zoom;
    const dy = (e.clientY - dragStartRef.current.startY) / zoom;
    onUpdate({
      ...block,
      text: localTextRef.current,
      x: Math.round(dragStartRef.current.initialBlockX + dx),
      y: Math.round(dragStartRef.current.initialBlockY + dy)
    });
  };

  const handleDragPointerUp = (e) => {
    if (isDragging) {
      e.stopPropagation();
      setIsDragging(false);
      isInteractingWithControlsRef.current = false;
      try {
        e.target.releasePointerCapture?.(e.pointerId);
      } catch (_) {}
      textareaRef.current?.focus();
    }
  };

  // Width resizing
  const handleResizePointerDown = (e) => {
    if (!canEdit) return;
    e.stopPropagation();
    e.preventDefault();
    isInteractingWithControlsRef.current = true;
    try {
      e.target.setPointerCapture?.(e.pointerId);
    } catch (_) {}
    setIsResizing(true);
    resizeStartRef.current = {
      startX: e.clientX,
      initialWidth: block.width || 320
    };
  };

  const handleResizePointerMove = (e) => {
    if (!isResizing) return;
    e.stopPropagation();
    e.preventDefault();
    const dx = (e.clientX - resizeStartRef.current.startX) / zoom;
    const newWidth = Math.max(200, Math.min(800, Math.round(resizeStartRef.current.initialWidth + dx)));
    onUpdate({
      ...block,
      text: localTextRef.current,
      width: newWidth
    });
  };

  const handleResizePointerUp = (e) => {
    if (isResizing) {
      e.stopPropagation();
      setIsResizing(false);
      isInteractingWithControlsRef.current = false;
      try {
        e.target.releasePointerCapture?.(e.pointerId);
      } catch (_) {}
    }
  };

  // Formatting actions with focus preservation
  const preventBlur = (e) => {
    e.preventDefault();
    e.stopPropagation();
    isInteractingWithControlsRef.current = true;
    setTimeout(() => {
      isInteractingWithControlsRef.current = false;
    }, 300);
  };

  const changeFontSize = (delta) => {
    const curSize = block.fontSize || 18;
    const nextSize = Math.max(12, Math.min(64, curSize + delta));
    onUpdate({ ...block, fontSize: nextSize, text: localTextRef.current });
  };

  const toggleBold = () => {
    const next = block.fontWeight === 'bold' ? 'normal' : 'bold';
    onUpdate({ ...block, fontWeight: next, text: localTextRef.current });
  };

  const toggleItalic = () => {
    const next = block.fontStyle === 'italic' ? 'normal' : 'italic';
    onUpdate({ ...block, fontStyle: next, text: localTextRef.current });
  };

  const toggleAlign = () => {
    const next = block.textAlign === 'center' ? 'left' : 'center';
    onUpdate({ ...block, textAlign: next, text: localTextRef.current });
  };

  const selectStyle = (styleId) => {
    onUpdate({ ...block, style: styleId, text: localTextRef.current });
    setShowColorPicker(false);
    textareaRef.current?.focus();
  };

  const currentStyleId = block.style || 'yellow';
  const currentStyle = NOTE_STYLES.find((s) => s.id === currentStyleId) || NOTE_STYLES[0];

  const baseFontSize = block.fontSize || 18;
  const isBold = block.fontWeight === 'bold';
  const isItalic = block.fontStyle === 'italic';
  const isCentered = block.textAlign === 'center';
  const showControls = canEdit && (isHovered || isFocused || isDragging || isResizing || showColorPicker);

  const blockWidth = block.width || 320;

  let textColor = darkMode ? currentStyle.darkText : currentStyle.defaultText;
  if (block.color && currentStyleId === 'transparent') {
    textColor = block.color;
  }

  const isActive = isFocused || isDragging || isResizing || showColorPicker;

  const isTransparent = currentStyleId === 'transparent';
  const noteBg = darkMode ? currentStyle.darkBg : currentStyle.bg;

  return (
    <div
      ref={containerRef}
      data-text-block="true"
      onPointerDown={(e) => {
        if (!isPanMode) {
          e.stopPropagation();
          if (e.target !== textareaRef.current && !e.target.closest?.('button')) {
            textareaRef.current?.focus();
          }
        }
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`absolute top-0 left-0 group select-text touch-auto ${
        isActive ? 'z-30' : isHovered ? 'z-20' : 'z-10'
      } ${isPanMode ? 'pointer-events-none' : 'pointer-events-auto'}`}
      style={{
        transform: `translate3d(${block.x}px, ${block.y}px, 0)`,
        width: `${blockWidth}px`,
        touchAction: isDragging || isResizing ? 'none' : 'auto',
        userSelect: 'text'
      }}
    >
      {/* Note controls: visible on hover, focus, dragging, or resizing */}
      {showControls && (
        <div
          onPointerDown={preventBlur}
          onMouseDown={preventBlur}
          className="absolute bottom-full left-0 mb-2 flex items-center gap-0.5 whitespace-nowrap bg-paper border border-rule rounded-panel p-1 shadow-float text-ink z-40 select-none pointer-events-auto"
        >
          {/* Drag to move handle */}
          <div
            onPointerDown={handleDragPointerDown}
            onPointerMove={handleDragPointerMove}
            onPointerUp={handleDragPointerUp}
            onPointerCancel={handleDragPointerUp}
            title="Drag to move this note"
            className="flex items-center gap-1.5 h-9 sm:h-8 px-2 text-ink/75 hover:text-ink hover:bg-paper-2 cursor-grab active:cursor-grabbing text-[13px] font-medium rounded-ctl transition-colors touch-none"
          >
            <Move className="w-4 h-4" />
            <span className="hidden sm:inline">Move</span>
          </div>

          <span className="w-px h-5 bg-rule mx-0.5" />

          {/* Note paper colour */}
          <div className="relative">
            <button
              type="button"
              onPointerDown={preventBlur}
              onMouseDown={preventBlur}
              onClick={() => setShowColorPicker(!showColorPicker)}
              title="Note colour"
              aria-label="Note colour"
              aria-expanded={showColorPicker}
              className={NOTE_BTN}
            >
              <span
                className="w-[18px] h-[18px] rounded-[3px] border border-ink/20"
                style={{ backgroundColor: currentStyle.swatch === 'transparent' ? 'transparent' : currentStyle.swatch }}
              />
            </button>

            {showColorPicker && (
              <div
                onPointerDown={preventBlur}
                onMouseDown={preventBlur}
                className="menu absolute bottom-full left-0 mb-2 flex items-center gap-1.5 p-2 z-50"
              >
                {NOTE_STYLES.map((style) => {
                  const selected = currentStyleId === style.id;
                  return (
                    <button
                      key={style.id}
                      type="button"
                      onPointerDown={preventBlur}
                      onMouseDown={preventBlur}
                      onClick={() => selectStyle(style.id)}
                      title={style.label}
                      aria-label={style.label}
                      aria-pressed={selected}
                      className={`w-8 h-8 sm:w-7 sm:h-7 rounded-[4px] border border-ink/20 cursor-pointer flex items-center justify-center transition-transform ${
                        selected ? 'ring-2 ring-ink ring-offset-2 ring-offset-paper' : 'hover:scale-110'
                      }`}
                      style={{
                        backgroundColor: style.swatch === 'transparent' ? 'transparent' : style.swatch,
                        backgroundImage: style.swatch === 'transparent'
                          ? 'linear-gradient(135deg, transparent 45%, rgb(var(--correction)) 45%, rgb(var(--correction)) 55%, transparent 55%)'
                          : undefined
                      }}
                    >
                      {selected && style.swatch !== 'transparent' && (
                        <Check className="w-3.5 h-3.5 stroke-[3]" style={{ color: style.defaultText }} />
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <span className="w-px h-5 bg-rule mx-0.5" />

          {/* Font size */}
          <button
            type="button"
            onPointerDown={preventBlur}
            onMouseDown={preventBlur}
            onClick={() => changeFontSize(-2)}
            title="Smaller text"
            aria-label="Smaller text"
            className={NOTE_BTN}
          >
            <Minus className="w-3.5 h-3.5" />
          </button>
          <span className="text-xs tabular-nums text-pencil min-w-[2.25rem] text-center">{baseFontSize}px</span>
          <button
            type="button"
            onPointerDown={preventBlur}
            onMouseDown={preventBlur}
            onClick={() => changeFontSize(2)}
            title="Larger text"
            aria-label="Larger text"
            className={NOTE_BTN}
          >
            <Plus className="w-3.5 h-3.5" />
          </button>

          <span className="w-px h-5 bg-rule mx-0.5" />

          <button
            type="button"
            onPointerDown={preventBlur}
            onMouseDown={preventBlur}
            onClick={toggleBold}
            title={isBold ? 'Remove bold' : 'Bold'}
            aria-pressed={isBold}
            className={isBold ? NOTE_BTN_ON : NOTE_BTN}
            style={isBold ? HL_RADIUS : undefined}
          >
            <Bold className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onPointerDown={preventBlur}
            onMouseDown={preventBlur}
            onClick={toggleItalic}
            title={isItalic ? 'Remove italic' : 'Italic'}
            aria-pressed={isItalic}
            className={isItalic ? NOTE_BTN_ON : NOTE_BTN}
            style={isItalic ? HL_RADIUS : undefined}
          >
            <Italic className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onPointerDown={preventBlur}
            onMouseDown={preventBlur}
            onClick={toggleAlign}
            title={isCentered ? 'Align left' : 'Centre text'}
            aria-pressed={isCentered}
            className={isCentered ? NOTE_BTN_ON : NOTE_BTN}
            style={isCentered ? HL_RADIUS : undefined}
          >
            {isCentered ? <AlignCenter className="w-3.5 h-3.5" /> : <AlignLeft className="w-3.5 h-3.5" />}
          </button>

          <span className="w-px h-5 bg-rule mx-0.5" />

          <button
            type="button"
            onPointerDown={preventBlur}
            onMouseDown={preventBlur}
            onClick={(e) => {
              e.stopPropagation();
              useNotebookStore.getState().pushUndo({ type: 'text:update', textBlock: block });
              onDelete(block.id);
            }}
            title="Delete note"
            aria-label="Delete note"
            className={`${NOTE_BTN} text-correction hover:text-correction hover:bg-correction/10`}
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* The note itself: a flat square of paper with a glued strip along the top */}
      <div
        className={`relative transition-shadow duration-150 ${
          isTransparent
            ? `rounded-[4px] border border-dashed ${isActive || isHovered ? 'border-pencil/60' : 'border-transparent'}`
            : 'rounded-[3px]'
        }`}
        style={{
          backgroundColor: noteBg,
          backgroundImage: isTransparent
            ? undefined
            : `linear-gradient(to bottom, rgb(0 0 0 / ${darkMode ? 0.12 : 0.045}) 0, rgb(0 0 0 / 0) 22px)`,
          boxShadow: isTransparent
            ? undefined
            : isActive
            ? '0 1px 1px rgb(0 0 0 / 0.12), 0 14px 24px -12px rgb(0 0 0 / 0.45)'
            : '0 1px 1px rgb(0 0 0 / 0.1), 0 8px 14px -10px rgb(0 0 0 / 0.4)',
          outline: isActive ? '2px solid rgb(var(--ballpoint))' : 'none',
          outlineOffset: 3
        }}
      >
        <div className="px-4 pt-4 pb-3.5">
          <textarea
            ref={textareaRef}
            value={localText}
            readOnly={!canEdit}
            onFocus={() => setIsFocused(true)}
            onBlur={handleBlur}
            onChange={handleTextChange}
            onKeyDown={handleKeyDown}
            placeholder={isFocused || !localText ? 'Write something…' : ''}
            rows={1}
            className="w-full bg-transparent resize-none focus:outline-none focus-visible:outline-none cursor-text select-text touch-auto border-0 placeholder:opacity-50 overflow-hidden font-hand"
            style={{
              color: textColor,
              fontSize: `${baseFontSize}px`,
              fontWeight: isBold ? 'bold' : 'normal',
              fontStyle: isItalic ? 'italic' : 'normal',
              textAlign: isCentered ? 'center' : 'left',
              lineHeight: 1.4,
              caretColor: textColor,
              userSelect: 'text',
              WebkitUserSelect: 'text',
              touchAction: 'auto'
            }}
          />
        </div>

        {/* Right edge: drag to resize width */}
        {showControls && (
          <div
            onPointerDown={handleResizePointerDown}
            onPointerMove={handleResizePointerMove}
            onPointerUp={handleResizePointerUp}
            onPointerCancel={handleResizePointerUp}
            title="Drag to change width"
            className={`absolute -right-2 top-0 bottom-0 w-5 cursor-ew-resize flex items-center justify-center select-none touch-none transition-opacity ${
              isResizing ? 'opacity-100' : 'opacity-60 hover:opacity-100'
            }`}
            style={{ color: textColor }}
          >
            <GripVertical className="w-4 h-4" />
          </div>
        )}
      </div>
    </div>
  );
}
