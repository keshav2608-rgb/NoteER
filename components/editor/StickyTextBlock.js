'use client';
import React, { useState, useRef, useEffect } from 'react';
import { useNotebookStore } from '@/lib/store/useNotebookStore';
import { Trash2, Move } from 'lucide-react';

export default function StickyTextBlock({
  block,
  onUpdate,
  onDelete,
  zoom = 1,
  panX = 0,
  panY = 0,
  isDarkModeOverride,
  canEditOverride,
  toolOverride
}) {
  const storeState = useNotebookStore();
  const canEdit = canEditOverride !== undefined ? canEditOverride : storeState.canEdit;
  const darkMode = isDarkModeOverride !== undefined ? isDarkModeOverride : storeState.darkMode;
  const currentTool = toolOverride !== undefined ? toolOverride : storeState.tool;
  const isPanMode = currentTool === 'pan' || currentTool === 'hand';

  const [isFocused, setIsFocused] = useState(!block.text);
  const [isHovered, setIsHovered] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const textareaRef = useRef(null);
  const dragStartRef = useRef({ startX: 0, startY: 0, initialBlockX: block.x, initialBlockY: block.y });

  // Auto-focus new text block
  useEffect(() => {
    if (!block.text && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [block.text]);

  // Auto-grow textarea height
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.max(28, textareaRef.current.scrollHeight)}px`;
    }
  }, [block.text]);

  const handleBlur = () => {
    setIsFocused(false);
    if (!block.text?.trim() && onDelete) {
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

  // Determine textColor
  let textColor = block.color;
  if (!textColor || textColor === '#fffbeb' || textColor === '#fef08a') {
    textColor = darkMode ? '#f8fafc' : '#0f172a';
  }

  const baseFontSize = block.fontSize || 16;

  return (
    <div
      onPointerDown={(e) => {
        if (!isPanMode) {
          e.stopPropagation();
        }
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`absolute top-0 left-0 z-10 group select-none transition-shadow ${
        isPanMode ? 'pointer-events-none' : 'pointer-events-auto'
      }`}
      style={{
        transform: `translate3d(${block.x}px, ${block.y}px, 0)`,
        width: `${block.width || 320}px`
      }}
    >
      {/* Move & Delete controls: visible on hover, focus, or dragging */}
      {canEdit && (isHovered || isFocused || isDragging) && (
        <div
          onPointerDown={(e) => e.stopPropagation()}
          className="absolute -top-8 left-0 flex items-center gap-1.5 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-slate-200 dark:border-slate-800 rounded-lg px-2 py-0.5 shadow-md text-slate-500 z-20 animate-in fade-in duration-100 select-none"
        >
          <div
            onPointerDown={handleDragPointerDown}
            onPointerMove={handleDragPointerMove}
            onPointerUp={handleDragPointerUp}
            onPointerCancel={handleDragPointerUp}
            title="Drag to move note anywhere on canvas"
            className="flex items-center gap-1 px-1 py-0.5 hover:text-indigo-600 dark:hover:text-indigo-400 cursor-grab active:cursor-grabbing text-[11px] font-medium transition-colors"
          >
            <Move className="w-3 h-3 text-indigo-500" />
            <span>Move</span>
          </div>
          <span className="w-px h-3 bg-slate-200 dark:bg-slate-700" />
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(block.id);
            }}
            title="Delete text note"
            className="p-1 hover:text-rose-600 dark:hover:text-rose-400 transition-colors"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* Seamless in-canvas text (no card box, no background, no border) */}
      <textarea
        ref={textareaRef}
        value={block.text || ''}
        readOnly={!canEdit}
        onFocus={() => setIsFocused(true)}
        onBlur={handleBlur}
        onChange={(e) => onUpdate({ ...block, text: e.target.value })}
        placeholder={isFocused ? 'Type note...' : ''}
        rows={1}
        className={`w-full bg-transparent resize-none p-1 focus:outline-none font-sans leading-relaxed transition-all ${
          isFocused
            ? 'ring-1 ring-indigo-400/50 rounded-sm bg-indigo-50/5 dark:bg-indigo-950/10'
            : isHovered
            ? 'ring-1 ring-slate-300/40 dark:ring-slate-700/40 rounded-sm'
            : 'border-0'
        }`}
        style={{
          color: textColor,
          fontSize: `${baseFontSize}px`,
          lineHeight: 1.45,
          caretColor: textColor
        }}
      />
    </div>
  );
}
