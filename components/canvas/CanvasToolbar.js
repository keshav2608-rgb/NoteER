'use client';
import React, { useState } from 'react';
import { useNotebookStore } from '@/lib/store/useNotebookStore';
import {
  Pen,
  Pencil,
  Highlighter,
  Eraser,
  Square,
  Circle,
  Minus,
  MoveRight,
  Type,
  Hand,
  Undo2,
  Redo2,
  Trash2,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Palette
} from 'lucide-react';

const PALETTE = [
  '#0f172a', // Slate black
  '#2563eb', // Royal blue
  '#059669', // Emerald green
  '#dc2626', // Ruby red
  '#d97706', // Amber
  '#7c3aed', // Purple
  '#db2777', // Pink
  '#64748b'  // Slate grey
];

const STROKE_WIDTHS = [
  { label: 'Fine', value: 2 },
  { label: 'Medium', value: 4 },
  { label: 'Bold', value: 8 },
  { label: 'Marker', value: 16 }
];

export default function CanvasToolbar({ onUndo, onRedo, onClear }) {
  const {
    tool,
    setTool,
    color,
    setColor,
    strokeWidth,
    setStrokeWidth,
    zoom,
    setZoom,
    resetView,
    undoStack,
    redoStack,
    canEdit
  } = useNotebookStore();

  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showShapePicker, setShowShapePicker] = useState(false);

  const isShapeTool = ['rect', 'circle', 'line', 'arrow'].includes(tool);

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-30 flex flex-col items-center gap-2 max-w-[95vw]">
      {/* Floating Toolbar Pill */}
      <div className="flex items-center gap-1 sm:gap-1.5 p-1.5 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-canvas select-none overflow-x-auto no-scrollbar max-w-full">
        
        {/* Drawing Tools */}
        <div className="flex items-center gap-1 pr-1 sm:pr-1.5 border-r border-slate-200 dark:border-slate-800">
          <button
            type="button"
            onClick={() => setTool('pen')}
            title="Pen"
            className={`p-2 rounded-xl transition-all ${
              tool === 'pen'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Pen className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => setTool('pencil')}
            title="Pencil"
            className={`p-2 rounded-xl transition-all ${
              tool === 'pencil'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Pencil className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => setTool('highlighter')}
            title="Highlighter"
            className={`p-2 rounded-xl transition-all ${
              tool === 'highlighter'
                ? 'bg-amber-500 text-white shadow-sm'
                : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Highlighter className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => setTool('eraser')}
            title="Eraser"
            className={`p-2 rounded-xl transition-all ${
              tool === 'eraser'
                ? 'bg-rose-600 text-white shadow-sm'
                : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Eraser className="w-4 h-4" />
          </button>
        </div>

        {/* Shapes Menu Toggle */}
        <div className="relative flex items-center pr-1 sm:pr-1.5 border-r border-slate-200 dark:border-slate-800">
          <button
            type="button"
            onClick={() => setShowShapePicker(!showShapePicker)}
            title="Shapes"
            className={`p-2 rounded-xl transition-all flex items-center gap-1 ${
              isShapeTool
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            {tool === 'circle' && <Circle className="w-4 h-4" />}
            {tool === 'line' && <Minus className="w-4 h-4" />}
            {tool === 'arrow' && <MoveRight className="w-4 h-4" />}
            {(tool === 'rect' || !isShapeTool) && <Square className="w-4 h-4" />}
          </button>

          {showShapePicker && (
            <div className="absolute bottom-full mb-3 left-0 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-2 shadow-sheet flex items-center gap-1.5 animate-in fade-in zoom-in-95 z-40">
              <button
                type="button"
                onClick={() => { setTool('rect'); setShowShapePicker(false); }}
                className={`p-2 rounded-lg ${tool === 'rect' ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400' : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'}`}
                title="Rectangle"
              >
                <Square className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => { setTool('circle'); setShowShapePicker(false); }}
                className={`p-2 rounded-lg ${tool === 'circle' ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400' : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'}`}
                title="Circle / Ellipse"
              >
                <Circle className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => { setTool('line'); setShowShapePicker(false); }}
                className={`p-2 rounded-lg ${tool === 'line' ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400' : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'}`}
                title="Line"
              >
                <Minus className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => { setTool('arrow'); setShowShapePicker(false); }}
                className={`p-2 rounded-lg ${tool === 'arrow' ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400' : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'}`}
                title="Arrow"
              >
                <MoveRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* Text and Pan tools */}
        <div className="flex items-center gap-1 pr-1 sm:pr-1.5 border-r border-slate-200 dark:border-slate-800">
          <button
            type="button"
            onClick={() => setTool('text')}
            title="Sticky Text Note"
            className={`p-2 rounded-xl transition-all ${
              tool === 'text'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Type className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => setTool('pan')}
            title="Pan / Hand tool"
            className={`p-2 rounded-xl transition-all ${
              tool === 'pan'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Hand className="w-4 h-4" />
          </button>
        </div>

        {/* Color & Stroke Width Settings */}
        <div className="flex items-center gap-1 sm:gap-1.5 pr-1 sm:pr-1.5 border-r border-slate-200 dark:border-slate-800 relative">
          {/* Active color dot */}
          <button
            type="button"
            onClick={() => setShowColorPicker(!showColorPicker)}
            title="Colors & Stroke Width"
            className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-1"
          >
            <span
              className="w-5 h-5 rounded-full border border-slate-300 dark:border-slate-600 shadow-xs"
              style={{ backgroundColor: color }}
            />
          </button>

          {showColorPicker && (
            <div className="absolute bottom-full mb-3 left-1/2 -translate-x-1/2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3 shadow-sheet flex flex-col gap-3 min-w-[200px] animate-in fade-in zoom-in-95 z-40">
              <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Colors</div>
              <div className="grid grid-cols-4 gap-2">
                {PALETTE.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => { setColor(c); setShowColorPicker(false); }}
                    className={`w-7 h-7 rounded-full transition-transform border border-slate-300 dark:border-slate-700 ${
                      color === c ? 'scale-110 ring-2 ring-indigo-500 ring-offset-2 dark:ring-offset-slate-900' : 'hover:scale-105'
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>

              <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider pt-2 border-t border-slate-100 dark:border-slate-800">Thickness</div>
              <div className="flex items-center justify-between gap-1 bg-slate-50 dark:bg-slate-800 p-1 rounded-xl">
                {STROKE_WIDTHS.map((sw) => (
                  <button
                    key={sw.value}
                    type="button"
                    onClick={() => setStrokeWidth(sw.value)}
                    className={`px-2 py-1 text-xs rounded-lg font-medium transition-all ${
                      strokeWidth === sw.value
                        ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    {sw.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Undo / Redo */}
        <div className="flex items-center gap-0.5 pr-1 sm:pr-1.5 border-r border-slate-200 dark:border-slate-800">
          <button
            type="button"
            onClick={onUndo}
            disabled={!canEdit || undoStack.length === 0}
            title="Undo"
            className="p-2 rounded-xl text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white disabled:opacity-30 disabled:hover:bg-transparent"
          >
            <Undo2 className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={onRedo}
            disabled={!canEdit || redoStack.length === 0}
            title="Redo"
            className="p-2 rounded-xl text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white disabled:opacity-30 disabled:hover:bg-transparent"
          >
            <Redo2 className="w-4 h-4" />
          </button>
        </div>

        {/* Zoom Controls */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setZoom(zoom - 0.15)}
            title="Zoom Out"
            className="p-1.5 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={resetView}
            title="Reset View (100%)"
            className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white px-1 py-0.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800 min-w-[36px] text-center"
          >
            {Math.round(zoom * 100)}%
          </button>

          <button
            type="button"
            onClick={() => setZoom(zoom + 0.15)}
            title="Zoom In"
            className="p-1.5 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>

          {canEdit && (
            <button
              type="button"
              onClick={onClear}
              title="Clear Canvas"
              className="p-2 ml-1 rounded-xl text-slate-500 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
