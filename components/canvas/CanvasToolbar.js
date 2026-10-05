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
  Palette,
  Sliders,
  ChevronDown
} from 'lucide-react';

// Primary quick-swatches directly on the toolbar
const QUICK_COLORS = [
  '#0f172a', // Slate Black
  '#f8fafc', // Clean White
  '#2563eb', // Royal Blue
  '#059669', // Emerald Green
  '#d97706', // Amber Orange
  '#dc2626', // Ruby Red
  '#7c3aed'  // Purple
];

// Rich 16-color expanded palette inside color options modal
const EXPANDED_PALETTE = [
  { name: 'Obsidian', hex: '#0f172a' },
  { name: 'Pure White', hex: '#ffffff' },
  { name: 'Slate Grey', hex: '#64748b' },
  { name: 'Royal Blue', hex: '#2563eb' },
  { name: 'Sky Blue', hex: '#0ea5e9' },
  { name: 'Teal', hex: '#14b8a6' },
  { name: 'Emerald', hex: '#059669' },
  { name: 'Lime Green', hex: '#84cc16' },
  { name: 'Bright Yellow', hex: '#facc15' },
  { name: 'Amber Orange', hex: '#f59e0b' },
  { name: 'Deep Orange', hex: '#ea580c' },
  { name: 'Ruby Red', hex: '#dc2626' },
  { name: 'Rose Pink', hex: '#f43f5e' },
  { name: 'Fuchsia', hex: '#d946ef' },
  { name: 'Vivid Purple', hex: '#7c3aed' },
  { name: 'Indigo', hex: '#4f46e5' }
];

const STROKE_WIDTHS = [
  { label: 'Fine', value: 2 },
  { label: 'Medium', value: 4 },
  { label: 'Bold', value: 8 },
  { label: 'Marker', value: 16 },
  { label: 'Jumbo', value: 24 }
];

const OPACITY_PRESETS = [
  { label: '100%', value: 1.0 },
  { label: '75%', value: 0.75 },
  { label: '50%', value: 0.5 },
  { label: '25%', value: 0.25 }
];

export default function CanvasToolbar({ onUndo, onRedo, onClear }) {
  const {
    tool,
    setTool,
    color,
    setColor,
    strokeWidth,
    setStrokeWidth,
    opacity,
    setOpacity,
    fillColor,
    setFillColor,
    zoom,
    setZoom,
    resetView,
    undoStack,
    redoStack,
    canEdit,
    darkMode
  } = useNotebookStore();

  const [showSettingsPopover, setShowSettingsPopover] = useState(false);
  const [showShapePicker, setShowShapePicker] = useState(false);

  const isShapeTool = ['rect', 'circle', 'line', 'arrow'].includes(tool);

  // Automatically adjust tool defaults when switching to highlighter
  const handleSelectTool = (newTool) => {
    setTool(newTool);
    if (newTool === 'highlighter' && strokeWidth < 12) {
      setStrokeWidth(18);
    }
  };

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-30 flex flex-col items-center gap-2 max-w-[96vw]">
      {/* Floating Toolbar Pill */}
      <div className="flex items-center gap-1 sm:gap-1.5 p-1.5 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-slate-200/90 dark:border-slate-800 rounded-2xl shadow-canvas select-none overflow-x-auto no-scrollbar max-w-full">
        
        {/* Drawing Tools Group */}
        <div className="flex items-center gap-0.5 sm:gap-1 pr-1 sm:pr-1.5 border-r border-slate-200 dark:border-slate-800">
          <button
            type="button"
            onClick={() => handleSelectTool('pen')}
            title="Pen (Natural Ink)"
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
            onClick={() => handleSelectTool('pencil')}
            title="Pencil (Graphite Sketch)"
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
            onClick={() => handleSelectTool('highlighter')}
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
            onClick={() => handleSelectTool('eraser')}
            title="Eraser (Erase entire strokes / shapes)"
            className={`p-2 rounded-xl transition-all ${
              tool === 'eraser'
                ? 'bg-rose-600 text-white shadow-sm'
                : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Eraser className="w-4 h-4" />
          </button>
        </div>

        {/* Shapes Menu Group */}
        <div className="relative flex items-center pr-1 sm:pr-1.5 border-r border-slate-200 dark:border-slate-800">
          <button
            type="button"
            onClick={() => {
              setShowShapePicker(!showShapePicker);
              setShowSettingsPopover(false);
            }}
            title="Geometric Shapes (Rectangle, Circle, Line, Arrow)"
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
            <ChevronDown className="w-3 h-3 opacity-60" />
          </button>

          {showShapePicker && (
            <div className="absolute bottom-full mb-3 left-0 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-2 shadow-sheet flex items-center gap-1 animate-in fade-in zoom-in-95 z-40">
              <button
                type="button"
                onClick={() => { setTool('rect'); setShowShapePicker(false); }}
                className={`p-2 rounded-xl transition-colors ${tool === 'rect' ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 font-semibold' : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'}`}
                title="Rectangle"
              >
                <Square className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => { setTool('circle'); setShowShapePicker(false); }}
                className={`p-2 rounded-xl transition-colors ${tool === 'circle' ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 font-semibold' : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'}`}
                title="Circle / Ellipse"
              >
                <Circle className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => { setTool('line'); setShowShapePicker(false); }}
                className={`p-2 rounded-xl transition-colors ${tool === 'line' ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 font-semibold' : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'}`}
                title="Line"
              >
                <Minus className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => { setTool('arrow'); setShowShapePicker(false); }}
                className={`p-2 rounded-xl transition-colors ${tool === 'arrow' ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 font-semibold' : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'}`}
                title="Arrow"
              >
                <MoveRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* Text Note & Pan Hand */}
        <div className="flex items-center gap-0.5 sm:gap-1 pr-1 sm:pr-1.5 border-r border-slate-200 dark:border-slate-800">
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
            title="Hand / Pan Canvas (or hold Spacebar)"
            className={`p-2 rounded-xl transition-all ${
              tool === 'pan'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Hand className="w-4 h-4" />
          </button>
        </div>

        {/* Direct Quick Color Swatches directly visible on Toolbar */}
        <div className="hidden sm:flex items-center gap-1 px-1 border-r border-slate-200 dark:border-slate-800">
          {QUICK_COLORS.map((c) => {
            const isSelected = color.toLowerCase() === c.toLowerCase();
            return (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                title={`Color: ${c}`}
                className={`w-5 h-5 rounded-full transition-transform border border-slate-300 dark:border-slate-600 shadow-2xs ${
                  isSelected ? 'scale-125 ring-2 ring-indigo-500 ring-offset-2 dark:ring-offset-slate-900' : 'hover:scale-110'
                }`}
                style={{ backgroundColor: c }}
              />
            );
          })}
        </div>

        {/* Color & Stroke Customization Popover Button */}
        <div className="relative flex items-center pr-1 sm:pr-1.5 border-r border-slate-200 dark:border-slate-800">
          <button
            type="button"
            onClick={() => {
              setShowSettingsPopover(!showSettingsPopover);
              setShowShapePicker(false);
            }}
            title="Color Palette, Stroke Width, Opacity & Fill"
            className="flex items-center gap-1.5 p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            {/* Active Color dot preview */}
            <span
              className="w-5 h-5 rounded-full border-2 border-white dark:border-slate-700 shadow-sm"
              style={{ backgroundColor: color }}
            />
            <span
              className="rounded-full bg-slate-700 dark:bg-slate-300 hidden md:inline-block"
              style={{ width: Math.max(strokeWidth, 4), height: Math.max(strokeWidth, 4) }}
            />
            <Sliders className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
          </button>

          {showSettingsPopover && (
            <div className="absolute bottom-full mb-3 left-1/2 -translate-x-1/2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-4 shadow-2xl flex flex-col gap-3.5 w-72 max-w-[90vw] animate-in fade-in zoom-in-95 z-50 text-slate-900 dark:text-slate-100">
              
              {/* Color Header & Native Color Picker */}
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Color Options
                </span>
                
                {/* HTML5 Native Color Picker & Hex Tag */}
                <div className="flex items-center gap-2">
                  <div className="relative flex items-center justify-center cursor-pointer">
                    <input
                      type="color"
                      value={color}
                      onChange={(e) => setColor(e.target.value)}
                      className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                      title="Custom Color Picker"
                    />
                    <div
                      className="w-6 h-6 rounded-full border-2 border-slate-300 dark:border-slate-600 shadow-sm flex items-center justify-center"
                      style={{ backgroundColor: color }}
                    >
                      <Palette className="w-3 h-3 text-white drop-shadow-sm pointer-events-none" />
                    </div>
                  </div>
                  <span className="text-[11px] font-mono uppercase bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md text-slate-700 dark:text-slate-300">
                    {color}
                  </span>
                </div>
              </div>

              {/* 16-color Palette Grid */}
              <div className="grid grid-cols-8 gap-1.5">
                {EXPANDED_PALETTE.map((c) => {
                  const isSelected = color.toLowerCase() === c.hex.toLowerCase();
                  return (
                    <button
                      key={c.hex}
                      type="button"
                      onClick={() => setColor(c.hex)}
                      title={c.name}
                      className={`w-6 h-6 rounded-full transition-transform border border-slate-200 dark:border-slate-700 shadow-2xs ${
                        isSelected
                          ? 'scale-125 ring-2 ring-indigo-500 ring-offset-2 dark:ring-offset-slate-900 border-white'
                          : 'hover:scale-110'
                      }`}
                      style={{ backgroundColor: c.hex }}
                    />
                  );
                })}
              </div>

              {/* Stroke Width Slider & Presets */}
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Thickness: {strokeWidth}px
                  </span>
                  <div
                    className="rounded-full bg-slate-900 dark:bg-white"
                    style={{ width: Math.max(strokeWidth, 2), height: Math.max(strokeWidth, 2) }}
                  />
                </div>

                <div className="grid grid-cols-5 gap-1">
                  {STROKE_WIDTHS.map((sw) => (
                    <button
                      key={sw.value}
                      type="button"
                      onClick={() => setStrokeWidth(sw.value)}
                      className={`py-1 text-[11px] rounded-lg font-medium transition-all ${
                        strokeWidth === sw.value
                          ? 'bg-indigo-600 text-white shadow-2xs'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
                      }`}
                    >
                      {sw.label}
                    </button>
                  ))}
                </div>

                <input
                  type="range"
                  min="1"
                  max="36"
                  value={strokeWidth}
                  onChange={(e) => setStrokeWidth(Number(e.target.value))}
                  className="w-full accent-indigo-600 cursor-pointer h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg"
                />
              </div>

              {/* Opacity Slider */}
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex flex-col gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Ink Opacity: {Math.round((opacity || 1) * 100)}%
                </span>
                <div className="grid grid-cols-4 gap-1">
                  {OPACITY_PRESETS.map((op) => (
                    <button
                      key={op.value}
                      type="button"
                      onClick={() => setOpacity(op.value)}
                      className={`py-1 text-[11px] rounded-lg font-medium transition-all ${
                        opacity === op.value
                          ? 'bg-indigo-600 text-white shadow-2xs'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
                      }`}
                    >
                      {op.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Shape Fill Mode */}
              {isShapeTool && (
                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex flex-col gap-1.5">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Shape Fill
                  </span>
                  <div className="grid grid-cols-3 gap-1">
                    <button
                      type="button"
                      onClick={() => setFillColor('transparent')}
                      className={`py-1 text-[11px] rounded-lg font-medium transition-all ${
                        fillColor === 'transparent'
                          ? 'bg-indigo-600 text-white'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      Outline Only
                    </button>
                    <button
                      type="button"
                      onClick={() => setFillColor(color)}
                      className={`py-1 text-[11px] rounded-lg font-medium transition-all ${
                        fillColor === color
                          ? 'bg-indigo-600 text-white'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      Solid Fill
                    </button>
                    <button
                      type="button"
                      onClick={() => setFillColor(color + '33')} // 20% opacity hex
                      className={`py-1 text-[11px] rounded-lg font-medium transition-all ${
                        fillColor?.length === 9
                          ? 'bg-indigo-600 text-white'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      Translucent
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Undo / Redo */}
        <div className="flex items-center gap-0.5 pr-1 sm:pr-1.5 border-r border-slate-200 dark:border-slate-800">
          <button
            type="button"
            onClick={onUndo}
            disabled={!canEdit || undoStack.length === 0}
            title="Undo (Ctrl+Z)"
            className="p-2 rounded-xl text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
          >
            <Undo2 className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={onRedo}
            disabled={!canEdit || redoStack.length === 0}
            title="Redo (Ctrl+Y or Ctrl+Shift+Z)"
            className="p-2 rounded-xl text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
          >
            <Redo2 className="w-4 h-4" />
          </button>
        </div>

        {/* Zoom Controls */}
        <div className="flex items-center gap-0.5 sm:gap-1">
          <button
            type="button"
            onClick={() => setZoom(zoom - 0.15)}
            disabled={zoom <= 0.25}
            title="Zoom Out"
            className="p-1.5 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white disabled:opacity-30 transition-colors"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={resetView}
            title="Reset View (100%)"
            className="text-[11px] font-mono font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white px-1.5 py-0.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800 min-w-[40px] text-center transition-colors"
          >
            {Math.round(zoom * 100)}%
          </button>

          <button
            type="button"
            onClick={() => setZoom(zoom + 0.15)}
            disabled={zoom >= 4.0}
            title="Zoom In"
            className="p-1.5 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white disabled:opacity-30 transition-colors"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>

          {canEdit && (
            <button
              type="button"
              onClick={onClear}
              title="Clear Canvas"
              className="p-2 ml-0.5 rounded-xl text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
