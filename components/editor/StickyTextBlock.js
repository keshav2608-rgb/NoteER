'use client';
import React, { useState, useRef, useEffect } from 'react';
import { useNotebookStore } from '@/lib/store/useNotebookStore';
import { Trash2, Move } from 'lucide-react';

export default function StickyTextBlock({
  block,
  onUpdate,
  onDelete,
  zoom,
  panX,
  panY,
  isDarkModeOverride,
  canEditOverride
}) {
  const storeState = useNotebookStore();
  const canEdit = canEditOverride !== undefined ? canEditOverride : storeState.canEdit;
  const darkMode = isDarkModeOverride !== undefined ? isDarkModeOverride : storeState.darkMode;
  const [isFocused, setIsFocused] = useState(!block.text);
  const [isHovered, setIsHovered] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const textareaRef = useRef(null);
  const dragStartRef = useRef({ mouseX: 0, mouseY: 0, blockX: block.x, blockY: block.y });

  const screenX = block.x * zoom + panX;
  const screenY = block.y * zoom + panY;

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
  }, [block.text, zoom]);

  const handleBlur = () => {
    setIsFocused(false);
    if (!block.text?.trim() && onDelete) {
      onDelete(block.id);
    }
  };

  const handlePointerDownDrag = (e) => {
    if (!canEdit) return;
    e.stopPropagation();
    setIsDragging(true);
    dragStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      blockX: block.x,
      blockY: block.y
    };

    const handlePointerMove = (moveEvent) => {
      const dx = (moveEvent.clientX - dragStartRef.current.mouseX) / zoom;
      const dy = (moveEvent.clientY - dragStartRef.current.mouseY) / zoom;
      onUpdate({
        ...block,
        x: Math.round(dragStartRef.current.blockX + dx),
        y: Math.round(dragStartRef.current.blockY + dy)
      });
    };

    const handlePointerUp = () => {
      setIsDragging(false);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
  };

  // Determine textColor
  let textColor = block.color;
  if (!textColor || textColor === '#fffbeb' || textColor === '#fef08a') {
    textColor = darkMode ? '#f8fafc' : '#0f172a';
  }

  const baseFontSize = block.fontSize || 16;
  const scaledFontSize = Math.max(12, baseFontSize * zoom);

  return (
    <div
      onPointerDown={(e) => e.stopPropagation()}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="absolute z-10 group"
      style={{
        transform: `translate3d(${screenX}px, ${screenY}px, 0)`,
        width: `${Math.max(140, (block.width || 320) * zoom)}px`
      }}
    >
      {/* Subtle reposition & delete controls shown only on hover */}
      {canEdit && (isHovered || isDragging) && (
        <div className="absolute -top-7 left-0 flex items-center gap-1 bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm border border-slate-200 dark:border-slate-800 rounded-lg px-1.5 py-0.5 shadow-sm text-slate-500 z-20 animate-in fade-in duration-100">
          <button
            type="button"
            onPointerDown={handlePointerDownDrag}
            title="Drag to reposition text"
            className="p-1 hover:text-indigo-600 dark:hover:text-indigo-400 cursor-grab active:cursor-grabbing"
          >
            <Move className="w-3 h-3" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(block.id);
            }}
            title="Delete text"
            className="p-1 hover:text-rose-600"
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
          fontSize: `${scaledFontSize}px`,
          lineHeight: 1.45,
          caretColor: textColor
        }}
      />
    </div>
  );
}
