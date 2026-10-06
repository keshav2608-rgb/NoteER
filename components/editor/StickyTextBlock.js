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
  GripVertical
} from 'lucide-react';

const NOTE_STYLES = [
  {
    id: 'yellow',
    label: 'Yellow Sticky',
    bgClass: 'bg-amber-100/95 dark:bg-amber-950/80 border-amber-300/90 dark:border-amber-700/80 text-amber-950 dark:text-amber-100 shadow-md',
    swatch: '#fde047',
    defaultText: '#451a03',
    darkText: '#fef3c7'
  },
  {
    id: 'blue',
    label: 'Sky Note',
    bgClass: 'bg-sky-100/95 dark:bg-sky-950/80 border-sky-300/90 dark:border-sky-700/80 text-sky-950 dark:text-sky-100 shadow-md',
    swatch: '#38bdf8',
    defaultText: '#082f49',
    darkText: '#e0f2fe'
  },
  {
    id: 'green',
    label: 'Mint Note',
    bgClass: 'bg-emerald-100/95 dark:bg-emerald-950/80 border-emerald-300/90 dark:border-emerald-700/80 text-emerald-950 dark:text-emerald-100 shadow-md',
    swatch: '#4ade80',
    defaultText: '#064e3b',
    darkText: '#d1fae5'
  },
  {
    id: 'purple',
    label: 'Lavender',
    bgClass: 'bg-purple-100/95 dark:bg-purple-950/80 border-purple-300/90 dark:border-purple-700/80 text-purple-950 dark:text-purple-100 shadow-md',
    swatch: '#c084fc',
    defaultText: '#3b0764',
    darkText: '#f3e8ff'
  },
  {
    id: 'pink',
    label: 'Rose Pink',
    bgClass: 'bg-rose-100/95 dark:bg-rose-950/80 border-rose-300/90 dark:border-rose-700/80 text-rose-950 dark:text-rose-100 shadow-md',
    swatch: '#fb7185',
    defaultText: '#4c0519',
    darkText: '#ffe4e6'
  },
  {
    id: 'card',
    label: 'Modern Card',
    bgClass: 'bg-white/95 dark:bg-slate-900/95 border-slate-200/90 dark:border-slate-800 text-slate-900 dark:text-slate-100 shadow-lg backdrop-blur-md',
    swatch: '#ffffff',
    defaultText: '#0f172a',
    darkText: '#f8fafc'
  },
  {
    id: 'transparent',
    label: 'Transparent',
    bgClass: 'bg-transparent border-dashed border-slate-300/50 dark:border-slate-700/50 text-slate-900 dark:text-slate-100',
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

  const textareaRef = useRef(null);
  const dragStartRef = useRef({ startX: 0, startY: 0, initialBlockX: block.x, initialBlockY: block.y });
  const resizeStartRef = useRef({ startX: 0, initialWidth: block.width || 320 });
  const debounceTimerRef = useRef(null);
  const localTextRef = useRef(localText);
  localTextRef.current = localText;

  // Auto-focus with micro-delay so container pointerup doesn't steal focus
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

  // Sync incoming text updates from remote peers when local user is NOT typing
  useEffect(() => {
    if (!isFocused && block.text !== undefined && block.text !== localTextRef.current) {
      setLocalText(block.text || '');
    }
  }, [block.text, isFocused]);

  // Clean up debounce timer on unmount
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
      textareaRef.current.style.height = `${Math.max(40, textareaRef.current.scrollHeight)}px`;
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

  const handleBlur = (e) => {
    if (isDragging || isResizing) return;
    if (e?.relatedTarget && e.currentTarget?.contains?.(e?.relatedTarget)) {
      return;
    }
    setIsFocused(false);
    setShowColorPicker(false);
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }

    // Auto-clean: If text is completely empty, remove block
    if (!localTextRef.current || !localTextRef.current.trim()) {
      if (onDelete) {
        onDelete(block.id);
      }
      return;
    }

    if (localTextRef.current !== block.text) {
      onUpdate({ ...block, text: localTextRef.current });
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      textareaRef.current?.blur();
      setIsFocused(false);
      setShowColorPicker(false);
    }
    if ((e.key === 'Backspace' || e.key === 'Delete') && !localText && onDelete) {
      onDelete(block.id);
    }
  };

  // Drag movement
  const handleDragPointerDown = (e) => {
    if (!canEdit) return;
    e.stopPropagation();
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
      try {
        e.target.releasePointerCapture?.(e.pointerId);
      } catch (_) {}
    }
  };

  // Width resizing
  const handleResizePointerDown = (e) => {
    if (!canEdit) return;
    e.stopPropagation();
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
      try {
        e.target.releasePointerCapture?.(e.pointerId);
      } catch (_) {}
    }
  };

  // Formatting helpers
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
  };

  // Determine active note style
  const currentStyleId = block.style || 'yellow';
  const currentStyle = NOTE_STYLES.find((s) => s.id === currentStyleId) || NOTE_STYLES[0];

  const baseFontSize = block.fontSize || 18;
  const isBold = block.fontWeight === 'bold';
  const isItalic = block.fontStyle === 'italic';
  const isCentered = block.textAlign === 'center';
  const showControls = canEdit && (isHovered || isFocused || isDragging || isResizing || showColorPicker);

  const blockWidth = block.width || 320;

  // Text color based on style and dark mode
  let textColor = darkMode ? currentStyle.darkText : currentStyle.defaultText;
  if (block.color && currentStyleId === 'transparent') {
    textColor = block.color;
  }

  return (
    <div
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
      className={`absolute top-0 left-0 z-10 group rounded-2xl border transition-all ${
        isPanMode ? 'pointer-events-none' : 'pointer-events-auto'
      } ${currentStyle.bgClass} ${
        isFocused || isDragging || isResizing
          ? 'ring-2 ring-indigo-500/80 shadow-xl'
          : isHovered
          ? 'ring-1 ring-indigo-400/50 shadow-lg'
          : ''
      }`}
      style={{
        transform: `translate3d(${block.x}px, ${block.y}px, 0)`,
        width: `${blockWidth}px`,
        touchAction: isDragging || isResizing ? 'none' : 'auto',
        userSelect: 'text'
      }}
    >
      {/* Floating Toolbar: visible on hover, focus, or dragging */}
      {showControls && (
        <div
          onPointerDown={(e) => e.stopPropagation()}
          className="absolute -top-11 left-0 flex items-center gap-1 bg-white/98 dark:bg-slate-900/98 backdrop-blur-md border border-slate-200/90 dark:border-slate-800 rounded-2xl px-2 py-1 shadow-xl text-slate-700 dark:text-slate-300 z-30 animate-in fade-in zoom-in-95 select-none pointer-events-auto"
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
            <span className="hidden sm:inline">Move</span>
          </div>

          <span className="w-px h-3.5 bg-slate-200 dark:bg-slate-700" />

          {/* Note Style / Color Swatches Picker */}
          <div className="relative">
            <button
              type="button"
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
                onPointerDown={(e) => e.stopPropagation()}
                className="absolute bottom-full left-0 mb-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-2 shadow-2xl flex items-center gap-1.5 z-40 animate-in fade-in zoom-in-95"
              >
                {NOTE_STYLES.map((style) => (
                  <button
                    key={style.id}
                    type="button"
                    onClick={() => selectStyle(style.id)}
                    title={style.label}
                    className={`w-6 h-6 rounded-full border transition-transform cursor-pointer ${
                      currentStyleId === style.id
                        ? 'scale-125 ring-2 ring-indigo-500 ring-offset-2 dark:ring-offset-slate-900 border-white'
                        : 'border-slate-300 dark:border-slate-600 hover:scale-110'
                    }`}
                    style={{
                      backgroundColor: style.swatch === 'transparent' ? '#f1f5f9' : style.swatch
                    }}
                  />
                ))}
              </div>
            )}
          </div>

          <span className="w-px h-3.5 bg-slate-200 dark:bg-slate-700" />

          {/* Font size adjustments */}
          <div className="flex items-center">
            <button
              type="button"
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
            onClick={(e) => {
              e.stopPropagation();
              onDelete(block.id);
            }}
            title="Delete text note"
            className="p-1 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5 text-rose-500" />
          </button>
        </div>
      )}

      {/* Note Body Textarea */}
      <div className="p-3 relative">
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
          className="w-full bg-transparent resize-none focus:outline-none leading-relaxed transition-all cursor-text select-text touch-auto border-0 placeholder:opacity-50"
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
      </div>

      {/* Right Edge Width Resize Handle */}
      {showControls && (
        <div
          onPointerDown={handleResizePointerDown}
          onPointerMove={handleResizePointerMove}
          onPointerUp={handleResizePointerUp}
          onPointerCancel={handleResizePointerUp}
          title="Drag to resize note width"
          className="absolute right-0 top-0 bottom-0 w-3 cursor-ew-resize flex items-center justify-center text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 group-hover:opacity-100 opacity-60 transition-opacity select-none"
        >
          <GripVertical className="w-3.5 h-3.5" />
        </div>
      )}
    </div>
  );
}
