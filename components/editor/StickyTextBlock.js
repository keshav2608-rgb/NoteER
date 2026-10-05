'use client';
import React, { useState, useRef, useEffect } from 'react';
import { useNotebookStore } from '@/lib/store/useNotebookStore';
import { Trash2, Move, Plus, Minus } from 'lucide-react';

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

  const textareaRef = useRef(null);
  const dragStartRef = useRef({ startX: 0, startY: 0, initialBlockX: block.x, initialBlockY: block.y });
  const debounceTimerRef = useRef(null);
  const localTextRef = useRef(localText);
  localTextRef.current = localText;

  // Auto-focus with micro-delay so container pointerup/click doesn't steal focus
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

  // Sync incoming text updates from remote peers when the local user is NOT actively typing
  useEffect(() => {
    if (!isFocused && block.text !== undefined && block.text !== localTextRef.current) {
      setLocalText(block.text || '');
    }
  }, [block.text, isFocused]);

  // Clean up any pending debounce timers on unmount
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
      textareaRef.current.style.height = `${Math.max(34, textareaRef.current.scrollHeight)}px`;
    }
  }, [localText, block.fontSize]);

  const handleTextChange = (e) => {
    const val = e.target.value;
    setLocalText(val);

    // Debounce remote broadcast by 200ms to keep typing silky smooth with no caret jumping
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(() => {
      onUpdate({ ...block, text: val });
    }, 200);
  };

  const handleBlur = (e) => {
    // If blurring to controls within this block, or while actively dragging, do not delete
    if (isDragging) return;
    if (e?.relatedTarget && e.currentTarget?.contains?.(e?.relatedTarget)) {
      return;
    }
    setIsFocused(false);
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }

    // Auto-clean: If text is completely empty, remove block so empty ghost blocks never linger
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
    }
    if ((e.key === 'Backspace' || e.key === 'Delete') && !localText && onDelete) {
      onDelete(block.id);
    }
  };

  // Pointer drag handler with pointer capture (works for both mouse and touch/stylus)
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

  const changeFontSize = (delta) => {
    const curSize = block.fontSize || 18;
    const nextSize = Math.max(12, Math.min(64, curSize + delta));
    onUpdate({ ...block, fontSize: nextSize, text: localTextRef.current });
  };

  // Determine textColor
  let textColor = block.color;
  if (!textColor || textColor === '#fffbeb' || textColor === '#fef08a') {
    textColor = darkMode ? '#f8fafc' : '#0f172a';
  }

  const baseFontSize = block.fontSize || 18;
  const showControls = canEdit && (isHovered || isFocused || isDragging);

  return (
    <div
      data-text-block="true"
      onPointerDown={(e) => {
        if (!isPanMode) {
          e.stopPropagation();
          // Clicking anywhere on the text block activates and focuses it
          if (e.target !== textareaRef.current && !e.target.closest?.('button')) {
            textareaRef.current?.focus();
          }
        }
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`absolute top-0 left-0 z-10 group select-text touch-auto transition-all ${
        isPanMode ? 'pointer-events-none' : 'pointer-events-auto'
      } ${
        isFocused || isDragging
          ? 'ring-2 ring-indigo-500 rounded-xl bg-white/70 dark:bg-slate-900/70 shadow-md backdrop-blur-xs'
          : isHovered
          ? 'ring-1 ring-slate-300 dark:ring-slate-700 rounded-xl bg-white/30 dark:bg-slate-900/30'
          : 'rounded-xl'
      }`}
      style={{
        transform: `translate3d(${block.x}px, ${block.y}px, 0)`,
        width: `${block.width || 320}px`,
        touchAction: isDragging ? 'none' : 'auto',
        userSelect: 'text'
      }}
    >
      {/* Floating Toolbar: visible on hover, focus, or dragging */}
      {showControls && (
        <div
          onPointerDown={(e) => e.stopPropagation()}
          className="absolute -top-9 left-0 flex items-center gap-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-2 py-1 shadow-lg text-slate-700 dark:text-slate-300 z-20 animate-in fade-in duration-100 select-none pointer-events-auto"
        >
          {/* Drag to move handle */}
          <div
            onPointerDown={handleDragPointerDown}
            onPointerMove={handleDragPointerMove}
            onPointerUp={handleDragPointerUp}
            onPointerCancel={handleDragPointerUp}
            title="Drag to move note anywhere on canvas"
            className="flex items-center gap-1 px-1.5 py-0.5 hover:text-indigo-600 dark:hover:text-indigo-400 cursor-grab active:cursor-grabbing text-xs font-semibold transition-colors"
          >
            <Move className="w-3.5 h-3.5 text-indigo-500" />
            <span>Move</span>
          </div>

          <span className="w-px h-3.5 bg-slate-200 dark:bg-slate-700" />

          {/* Font size adjustments */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              changeFontSize(-2);
            }}
            title="Decrease font size"
            className="p-1 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors"
          >
            <Minus className="w-3 h-3" />
          </button>
          <span className="text-[11px] font-mono px-1 font-semibold">{baseFontSize}px</span>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              changeFontSize(2);
            }}
            title="Increase font size"
            className="p-1 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors"
          >
            <Plus className="w-3 h-3" />
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
            className="p-1 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5 text-rose-500" />
          </button>
        </div>
      )}

      {/* Seamless in-canvas text (written directly on canvas) */}
      <textarea
        ref={textareaRef}
        value={localText}
        readOnly={!canEdit}
        onFocus={() => setIsFocused(true)}
        onBlur={handleBlur}
        onChange={handleTextChange}
        onKeyDown={handleKeyDown}
        placeholder={isFocused || !localText ? 'Type note here...' : ''}
        rows={1}
        className="w-full bg-transparent resize-none p-1.5 focus:outline-none font-sans leading-relaxed transition-all cursor-text select-text touch-auto border-0 placeholder:text-slate-400 dark:placeholder:text-slate-500"
        style={{
          color: textColor,
          fontSize: `${baseFontSize}px`,
          lineHeight: 1.45,
          caretColor: textColor,
          userSelect: 'text',
          WebkitUserSelect: 'text',
          touchAction: 'auto'
        }}
      />
    </div>
  );
}
