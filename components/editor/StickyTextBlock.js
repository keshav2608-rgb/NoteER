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
  Palette,
  GripVertical,
  Check
} from 'lucide-react';

const NOTE_STYLES = [
  {
    id: 'yellow',
    label: 'Post-it Yellow',
    outerClass: 'bg-amber-200/50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-700/60 ring-1 ring-amber-400/30',
    innerClass: 'bg-amber-100/95 dark:bg-amber-900/40 text-amber-950 dark:text-amber-100 shadow-sm',
    swatch: '#fde047',
    defaultText: '#451a03',
    darkText: '#fef3c7'
  },
  {
    id: 'blue',
    label: 'Sky Note',
    outerClass: 'bg-sky-200/50 dark:bg-sky-950/40 border-sky-300 dark:border-sky-700/60 ring-1 ring-sky-400/30',
    innerClass: 'bg-sky-100/95 dark:bg-sky-900/40 text-sky-950 dark:text-sky-100 shadow-sm',
    swatch: '#38bdf8',
    defaultText: '#082f49',
    darkText: '#e0f2fe'
  },
  {
    id: 'green',
    label: 'Mint Note',
    outerClass: 'bg-emerald-200/50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-700/60 ring-1 ring-emerald-400/30',
    innerClass: 'bg-emerald-100/95 dark:bg-emerald-900/40 text-emerald-950 dark:text-emerald-100 shadow-sm',
    swatch: '#4ade80',
    defaultText: '#064e3b',
    darkText: '#d1fae5'
  },
  {
    id: 'purple',
    label: 'Lavender',
    outerClass: 'bg-purple-200/50 dark:bg-purple-950/40 border-purple-300 dark:border-purple-700/60 ring-1 ring-purple-400/30',
    innerClass: 'bg-purple-100/95 dark:bg-purple-900/40 text-purple-950 dark:text-purple-100 shadow-sm',
    swatch: '#c084fc',
    defaultText: '#3b0764',
    darkText: '#f3e8ff'
  },
  {
    id: 'pink',
    label: 'Rose Pink',
    outerClass: 'bg-rose-200/50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-700/60 ring-1 ring-rose-400/30',
    innerClass: 'bg-rose-100/95 dark:bg-rose-900/40 text-rose-950 dark:text-rose-100 shadow-sm',
    swatch: '#fb7185',
    defaultText: '#4c0519',
    darkText: '#ffe4e6'
  },
  {
    id: 'card',
    label: 'Frosted Card',
    outerClass: 'bg-slate-100/70 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 ring-1 ring-slate-300/40 dark:ring-slate-600/40',
    innerClass: 'bg-white/95 dark:bg-slate-900/95 text-slate-900 dark:text-slate-100 shadow-md backdrop-blur-md',
    swatch: '#ffffff',
    defaultText: '#0f172a',
    darkText: '#f8fafc'
  },
  {
    id: 'transparent',
    label: 'Transparent',
    outerClass: 'bg-transparent border-dashed border-slate-300/40 dark:border-slate-700/40',
    innerClass: 'bg-transparent text-slate-900 dark:text-slate-100',
    swatch: 'transparent',
    defaultText: '#0f172a',
    darkText: '#f8fafc'
  }
];

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
      className={`absolute top-0 left-0 group select-text touch-auto transition-all ${
        isActive ? 'z-30' : isHovered ? 'z-20' : 'z-10'
      } ${isPanMode ? 'pointer-events-none' : 'pointer-events-auto'}`}
      style={{
        transform: `translate3d(${block.x}px, ${block.y}px, 0)`,
        width: `${blockWidth}px`,
        touchAction: isDragging || isResizing ? 'none' : 'auto',
        userSelect: 'text'
      }}
    >
      {/* Floating Toolbar: visible on hover, focus, dragging, or resizing */}
      {showControls && (
        <div
          onPointerDown={preventBlur}
          onMouseDown={preventBlur}
          className="absolute -top-11 left-0 flex items-center gap-1 bg-white/98 dark:bg-slate-900/98 backdrop-blur-xl border border-slate-200/90 dark:border-slate-800 rounded-2xl px-2 py-1 shadow-2xl text-slate-700 dark:text-slate-300 z-40 animate-in fade-in zoom-in-95 select-none pointer-events-auto"
        >
          {/* Drag to move handle */}
          <div
            onPointerDown={handleDragPointerDown}
            onPointerMove={handleDragPointerMove}
            onPointerUp={handleDragPointerUp}
            onPointerCancel={handleDragPointerUp}
            title="Drag to move note anywhere on canvas"
            className="flex items-center gap-1 px-1.5 py-0.5 hover:text-indigo-600 dark:hover:text-indigo-400 cursor-grab active:cursor-grabbing text-xs font-semibold rounded-lg transition-colors"
          >
            <Move className="w-3.5 h-3.5 text-indigo-500" />
            <span className="hidden sm:inline text-[11px]">Move</span>
          </div>

          <span className="w-px h-3.5 bg-slate-200 dark:bg-slate-700" />

          {/* Note Style / Color Swatches Picker */}
          <div className="relative">
            <button
              type="button"
              onPointerDown={preventBlur}
              onMouseDown={preventBlur}
              onClick={() => setShowColorPicker(!showColorPicker)}
              title="Change sticky note color & style"
              className="flex items-center gap-1 p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
            >
              <div
                className="w-4 h-4 rounded-full border border-slate-300 dark:border-slate-600 shadow-2xs"
                style={{ backgroundColor: currentStyle.swatch === 'transparent' ? '#ffffff' : currentStyle.swatch }}
              />
              <Palette className="w-3 h-3 text-slate-400" />
            </button>

            {/* Color Palette Popover */}
            {showColorPicker && (
              <div
                onPointerDown={preventBlur}
                onMouseDown={preventBlur}
                className="absolute bottom-full left-0 mb-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-2 shadow-2xl flex items-center gap-1.5 z-50 animate-in fade-in zoom-in-95"
              >
                {NOTE_STYLES.map((style) => (
                  <button
                    key={style.id}
                    type="button"
                    onPointerDown={preventBlur}
                    onMouseDown={preventBlur}
                    onClick={() => selectStyle(style.id)}
                    title={style.label}
                    className={`w-6 h-6 rounded-full border transition-transform cursor-pointer flex items-center justify-center ${
                      currentStyleId === style.id
                        ? 'scale-125 ring-2 ring-indigo-500 ring-offset-2 dark:ring-offset-slate-900 border-white'
                        : 'border-slate-300 dark:border-slate-600 hover:scale-110'
                    }`}
                    style={{
                      backgroundColor: style.swatch === 'transparent' ? '#f1f5f9' : style.swatch
                    }}
                  >
                    {currentStyleId === style.id && (
                      <Check className="w-3 h-3 text-indigo-700 dark:text-indigo-300 stroke-[3]" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          <span className="w-px h-3.5 bg-slate-200 dark:bg-slate-700" />

          {/* Font size adjustments */}
          <div className="flex items-center">
            <button
              type="button"
              onPointerDown={preventBlur}
              onMouseDown={preventBlur}
              onClick={() => changeFontSize(-2)}
              title="Decrease font size"
              className="p-1 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
            >
              <Minus className="w-3 h-3" />
            </button>
            <span className="text-[11px] font-mono px-1 font-semibold min-w-[28px] text-center">
              {baseFontSize}px
            </span>
            <button
              type="button"
              onPointerDown={preventBlur}
              onMouseDown={preventBlur}
              onClick={() => changeFontSize(2)}
              title="Increase font size"
              className="p-1 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
            >
              <Plus className="w-3 h-3" />
            </button>
          </div>

          <span className="w-px h-3.5 bg-slate-200 dark:bg-slate-700" />

          {/* Bold Toggle */}
          <button
            type="button"
            onPointerDown={preventBlur}
            onMouseDown={preventBlur}
            onClick={toggleBold}
            title={isBold ? 'Unbold' : 'Bold text'}
            className={`p-1 rounded-lg transition-colors cursor-pointer ${
              isBold
                ? 'bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 font-bold'
                : 'hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Bold className="w-3 h-3" />
          </button>

          {/* Italic Toggle */}
          <button
            type="button"
            onPointerDown={preventBlur}
            onMouseDown={preventBlur}
            onClick={toggleItalic}
            title={isItalic ? 'Remove italic' : 'Italic text'}
            className={`p-1 rounded-lg transition-colors cursor-pointer ${
              isItalic
                ? 'bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300'
                : 'hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Italic className="w-3 h-3" />
          </button>

          {/* Text Alignment */}
          <button
            type="button"
            onPointerDown={preventBlur}
            onMouseDown={preventBlur}
            onClick={toggleAlign}
            title={isCentered ? 'Align left' : 'Align center'}
            className={`p-1 rounded-lg transition-colors cursor-pointer ${
              isCentered
                ? 'bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300'
                : 'hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            {isCentered ? <AlignCenter className="w-3 h-3" /> : <AlignLeft className="w-3 h-3" />}
          </button>

          <span className="w-px h-3.5 bg-slate-200 dark:bg-slate-700" />

          {/* Delete button */}
          <button
            type="button"
            onPointerDown={preventBlur}
            onMouseDown={preventBlur}
            onClick={(e) => {
              e.stopPropagation();
              useNotebookStore.getState().pushUndo({ type: 'text:update', textBlock: block });
              onDelete(block.id);
            }}
            title="Delete text note"
            className="p-1 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5 text-rose-500" />
          </button>
        </div>
      )}

      {/* Double-Bezel Card Container */}
      <div
        className={`p-1 rounded-2xl border transition-all ${currentStyle.outerClass} ${
          isActive
            ? 'ring-2 ring-indigo-500/80 shadow-2xl scale-[1.005]'
            : isHovered
            ? 'ring-1 ring-indigo-400/50 shadow-lg'
            : 'shadow-md'
        }`}
      >
        <div className={`p-3 rounded-xl transition-colors ${currentStyle.innerClass} relative`}>
          <textarea
            ref={textareaRef}
            value={localText}
            readOnly={!canEdit}
            onFocus={() => setIsFocused(true)}
            onBlur={handleBlur}
            onChange={handleTextChange}
            onKeyDown={handleKeyDown}
            placeholder={isFocused || !localText ? 'Type note...' : ''}
            rows={1}
            className="w-full bg-transparent resize-none focus:outline-none leading-relaxed transition-all cursor-text select-text touch-auto border-0 placeholder:opacity-50 overflow-hidden"
            style={{
              color: textColor,
              fontSize: `${baseFontSize}px`,
              fontWeight: isBold ? 'bold' : 'normal',
              fontStyle: isItalic ? 'italic' : 'normal',
              textAlign: isCentered ? 'center' : 'left',
              lineHeight: 1.45,
              caretColor: textColor,
              userSelect: 'text',
              WebkitUserSelect: 'text',
              touchAction: 'auto'
            }}
          />

          {/* Right Edge Width Resize Handle */}
          {showControls && (
            <div
              onPointerDown={handleResizePointerDown}
              onPointerMove={handleResizePointerMove}
              onPointerUp={handleResizePointerUp}
              onPointerCancel={handleResizePointerUp}
              title="Drag to resize note width"
              className={`absolute right-1 top-0 bottom-0 w-4 cursor-ew-resize flex items-center justify-center text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors select-none ${
                isResizing ? 'text-indigo-600 dark:text-indigo-400 opacity-100' : 'opacity-60 hover:opacity-100'
              }`}
            >
              <GripVertical className="w-4 h-4" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
