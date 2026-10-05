'use client';
import React, { useState, useRef } from 'react';
import { useNotebookStore } from '@/lib/store/useNotebookStore';
import { Trash2, GripVertical } from 'lucide-react';

export default function StickyTextBlock({ block, onUpdate, onDelete, zoom, panX, panY }) {
  const { canEdit } = useNotebookStore();
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ mouseX: 0, mouseY: 0, blockX: block.x, blockY: block.y });

  const screenX = block.x * zoom + panX;
  const screenY = block.y * zoom + panY;

  const handlePointerDownHeader = (e) => {
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

  return (
    <div
      onPointerDown={(e) => e.stopPropagation()}
      className={`absolute z-10 rounded-xl shadow-sheet border transition-shadow ${
        isDragging ? 'shadow-2xl ring-2 ring-indigo-500 cursor-grabbing' : 'hover:shadow-md'
      }`}
      style={{
        transform: `translate3d(${screenX}px, ${screenY}px, 0)`,
        width: `${(block.width || 260) * zoom}px`,
        backgroundColor: block.color || '#fffbeb',
        borderColor: block.borderColor || '#fef08a'
      }}
    >
      {/* Header bar with drag handle and delete */}
      <div
        onPointerDown={handlePointerDownHeader}
        className="flex items-center justify-between px-2.5 py-1.5 cursor-grab border-b border-black/5 select-none"
      >
        <div className="flex items-center gap-1 text-slate-500">
          <GripVertical className="w-3.5 h-3.5" />
          <span className="text-[11px] font-semibold uppercase tracking-wider">Note</span>
        </div>

        {canEdit && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(block.id);
            }}
            className="text-slate-400 hover:text-rose-600 p-0.5 rounded transition-colors"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        )}
      </div>

      {/* Text area */}
      <textarea
        value={block.text || ''}
        readOnly={!canEdit}
        onChange={(e) => onUpdate({ ...block, text: e.target.value })}
        placeholder="Type notebook notes here..."
        className="w-full h-28 p-2.5 bg-transparent resize-none focus:outline-none text-slate-800 text-sm leading-relaxed"
        style={{ fontSize: `${13 * zoom}px` }}
      />
    </div>
  );
}
