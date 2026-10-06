'use client';
import React, { useState, useRef, useEffect } from 'react';
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
  MousePointer2,
  Undo2,
  Redo2,
  Trash2,
  ZoomIn,
  ZoomOut,
  Palette,
  Sliders,
  ChevronDown,
  Grid,
  CircleDot,
  AlignLeft,
  FileText,
  Check
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

const SHAPE_TOOLS = [
  { id: 'rect', label: 'Rectangle', icon: Square },
  { id: 'circle', label: 'Circle', icon: Circle },
  { id: 'line', label: 'Line', icon: Minus },
  { id: 'arrow', label: 'Arrow', icon: MoveRight }
];

const PAPER_STYLES = [
  { id: 'dotted', label: 'Dotted Paper', desc: 'Subtle dots for clean writing & sketching', icon: CircleDot },
  { id: 'grid', label: 'Math Grid', desc: 'Precise square grid for graphs & technical notes', icon: Grid },
  { id: 'ruled', label: 'Ruled Lined', desc: 'Lined paper with margin for neat handwriting', icon: AlignLeft },
  { id: 'blank', label: 'Blank Canvas', desc: 'Pure clean canvas with no guidelines', icon: FileText }
];

export default function CanvasToolbar({
  onUndo,
  onRedo,
  onClear,
  onClearNotebook,
  backgroundType = 'dotted',
  onUpdateBackground,
  onOpenPaperStyleModal
}) {
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
  const [showThicknessPopover, setShowThicknessPopover] = useState(false);
  const [showClearMenu, setShowClearMenu] = useState(false);
  const [showPaperPopover, setShowPaperPopover] = useState(false);
  const [selectedShape, setSelectedShape] = useState('rect');

  const shapePickerRef = useRef(null);
  const settingsRef = useRef(null);
  const thicknessRef = useRef(null);
  const clearBtnRef = useRef(null);
  const clearMenuRef = useRef(null);
  const shapeBtnRef = useRef(null);
  const settingsBtnRef = useRef(null);
  const thicknessBtnRef = useRef(null);
  const paperBtnRef = useRef(null);
  const paperPopoverRef = useRef(null);

  const isShapeTool = ['rect', 'rectangle', 'circle', 'line', 'arrow'].includes(tool);

  // Sync selected shape when tool changes to a shape
  useEffect(() => {
    if (['rect', 'rectangle', 'circle', 'line', 'arrow'].includes(tool)) {
      setSelectedShape(tool === 'rectangle' ? 'rect' : tool);
    }
  }, [tool]);

  // Click outside listener to dismiss popovers
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (
        shapePickerRef.current &&
        !shapePickerRef.current.contains(e.target) &&
        shapeBtnRef.current &&
        !shapeBtnRef.current.contains(e.target)
      ) {
        setShowShapePicker(false);
      }
      if (
        settingsRef.current &&
        !settingsRef.current.contains(e.target) &&
        settingsBtnRef.current &&
        !settingsBtnRef.current.contains(e.target)
      ) {
        setShowSettingsPopover(false);
      }
      if (
        thicknessRef.current &&
        !thicknessRef.current.contains(e.target) &&
        thicknessBtnRef.current &&
        !thicknessBtnRef.current.contains(e.target)
      ) {
        setShowThicknessPopover(false);
      }
      if (
        clearBtnRef.current &&
        !clearBtnRef.current.contains(e.target) &&
        clearMenuRef.current &&
        !clearMenuRef.current.contains(e.target)
      ) {
        setShowClearMenu(false);
      }
      if (
        paperPopoverRef.current &&
        !paperPopoverRef.current.contains(e.target) &&
        paperBtnRef.current &&
        !paperBtnRef.current.contains(e.target)
      ) {
        setShowPaperPopover(false);
      }
    };
    document.addEventListener('pointerdown', handleClickOutside);
    return () => document.removeEventListener('pointerdown', handleClickOutside);
  }, []);

  // Escape key listener to dismiss all popovers
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setShowShapePicker(false);
        setShowSettingsPopover(false);
        setShowThicknessPopover(false);
        setShowClearMenu(false);
        setShowPaperPopover(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const togglePopover = (name) => {
    setShowPaperPopover((prev) => (name === 'paper' ? !prev : false));
    setShowThicknessPopover((prev) => (name === 'thickness' ? !prev : false));
    setShowSettingsPopover((prev) => (name === 'settings' ? !prev : false));
    setShowShapePicker((prev) => (name === 'shape' ? !prev : false));
    setShowClearMenu((prev) => (name === 'clear' ? !prev : false));
  };

  const handleSelectTool = (newTool) => {
    setTool(newTool);
  };

  const CurrentShapeIcon = SHAPE_TOOLS.find(s => s.id === (isShapeTool ? (tool === 'rectangle' ? 'rect' : tool) : selectedShape))?.icon || Square;

  return (
    <div className="fixed bottom-4 sm:bottom-6 left-1/2 -translate-x-1/2 z-30 flex flex-col items-center gap-2 max-w-[calc(100vw-16px)] sm:max-w-[96vw] pointer-events-none">
      {/* Unclipped Popovers Layer (Positioned directly above the toolbar pill) */}
      <div className="pointer-events-auto flex flex-col items-center">
        {/* Paper Style Popover */}
        {showPaperPopover && (
          <div
            ref={paperPopoverRef}
            onPointerDown={(e) => e.stopPropagation()}
            className="mb-2 p-1.5 rounded-[1.75rem] bg-slate-900/5 dark:bg-white/[0.04] border border-slate-200/80 dark:border-white/[0.08] shadow-2xl backdrop-blur-xl ring-1 ring-black/5 dark:ring-white/5 w-80 max-w-[92vw] z-50 animate-in fade-in zoom-in-95 pointer-events-auto"
          >
            <div className="rounded-[1.4rem] bg-white dark:bg-[#0c0e15] border border-slate-200/70 dark:border-white/[0.06] p-3 text-slate-900 dark:text-slate-100 flex flex-col gap-2.5">
              <div className="flex items-center justify-between px-1 pb-1 border-b border-slate-100 dark:border-slate-800">
                <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">
                  Page Paper Style
                </span>
                <span className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 capitalize">
                  {backgroundType || 'dotted'}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {PAPER_STYLES.map((style) => {
                  const Icon = style.icon;
                  const isSelected = (backgroundType || 'dotted') === style.id;
                  return (
                    <button
                      key={style.id}
                      type="button"
                      onClick={() => {
                        if (onUpdateBackground) {
                          onUpdateBackground(style.id);
                        }
                        setShowPaperPopover(false);
                      }}
                      className={`p-2.5 rounded-xl border text-left transition-all flex flex-col gap-1 cursor-pointer active:scale-[0.98] ${
                        isSelected
                          ? 'border-indigo-500 bg-indigo-50/70 dark:bg-indigo-950/60 shadow-xs text-indigo-950 dark:text-indigo-200 ring-1 ring-indigo-500'
                          : 'border-slate-200/80 dark:border-slate-800/80 hover:border-slate-300 dark:hover:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <Icon className={`w-3.5 h-3.5 ${isSelected ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-500'}`} />
                          <span className="text-xs font-bold">{style.label.split(' ')[0]}</span>
                        </div>
                        {isSelected && <Check className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />}
                      </div>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight">
                        {style.desc}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Shape Picker Popover */}
        {showShapePicker && (
          <div
            ref={shapePickerRef}
            onPointerDown={(e) => e.stopPropagation()}
            className="mb-2 p-1 rounded-2xl bg-slate-900/5 dark:bg-white/[0.04] border border-slate-200/80 dark:border-white/[0.08] shadow-2xl backdrop-blur-xl ring-1 ring-black/5 dark:ring-white/5 animate-in fade-in zoom-in-95 z-50 pointer-events-auto"
          >
            <div className="rounded-xl bg-white dark:bg-[#0c0e15] border border-slate-200/70 dark:border-white/[0.06] p-1.5 flex items-center gap-1 text-slate-900 dark:text-slate-100">
              {SHAPE_TOOLS.map((s) => {
                const Icon = s.icon;
                const isActive = (isShapeTool && (tool === s.id || (tool === 'rectangle' && s.id === 'rect'))) || selectedShape === s.id;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => {
                      setSelectedShape(s.id);
                      setTool(s.id);
                      setShowShapePicker(false);
                    }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                      isActive
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                    title={s.label}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="text-xs font-medium hidden sm:inline">{s.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Dedicated Stroke Thickness Popover */}
        {showThicknessPopover && (
          <div
            ref={thicknessRef}
            onPointerDown={(e) => e.stopPropagation()}
            className="mb-2 p-1.5 rounded-[1.75rem] bg-slate-900/5 dark:bg-white/[0.04] border border-slate-200/80 dark:border-white/[0.08] shadow-2xl backdrop-blur-xl ring-1 ring-black/5 dark:ring-white/5 w-76 max-w-[92vw] z-50 animate-in fade-in zoom-in-95 pointer-events-auto"
          >
            <div className="rounded-[1.4rem] bg-white dark:bg-[#0c0e15] border border-slate-200/70 dark:border-white/[0.06] p-3.5 text-slate-900 dark:text-slate-100 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">
                  Stroke Thickness
                </span>
                <span className="text-xs font-mono font-bold text-indigo-600 dark:text-indigo-400 px-2 py-0.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200/60 dark:border-indigo-800/60">
                  {strokeWidth}px
                </span>
              </div>

              {/* Live Visual Stroke Preview */}
              <div className="w-full h-8 bg-slate-100 dark:bg-slate-800/80 rounded-xl flex items-center justify-center px-4 overflow-hidden border border-slate-200/60 dark:border-slate-700/60">
                <div
                  className="w-full rounded-full transition-all"
                  style={{
                    height: `${Math.max(1, Math.min(strokeWidth, 24))}px`,
                    backgroundColor: color === '#ffffff' || color === '#f8fafc' ? (darkMode ? '#ffffff' : '#0f172a') : color
                  }}
                />
              </div>

              {/* Quick Presets */}
              <div className="grid grid-cols-5 gap-1.5">
                {STROKE_WIDTHS.map((sw) => (
                  <button
                    key={sw.value}
                    type="button"
                    onClick={() => setStrokeWidth(sw.value)}
                    className={`py-1.5 px-1 rounded-xl font-medium transition-all text-center flex flex-col items-center justify-center cursor-pointer ${
                      strokeWidth === sw.value
                        ? 'bg-indigo-600 text-white shadow-xs font-semibold'
                        : 'bg-slate-100/80 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                    }`}
                  >
                    <span className="font-bold text-xs leading-none">{sw.value}px</span>
                    <span className="text-[9px] opacity-75 mt-0.5">{sw.label}</span>
                  </button>
                ))}
              </div>

              {/* Interactive Range Slider + Step Controls */}
              <div className="flex items-center gap-2 pt-0.5">
                <button
                  type="button"
                  onClick={() => setStrokeWidth(Math.max(1, strokeWidth - 1))}
                  className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center text-xs font-bold text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
                  title="Decrease thickness by 1px"
                >
                  -
                </button>
                <input
                  type="range"
                  min="1"
                  max="48"
                  value={strokeWidth}
                  onChange={(e) => setStrokeWidth(Number(e.target.value))}
                  onInput={(e) => setStrokeWidth(Number(e.target.value))}
                  className="w-full accent-indigo-600 cursor-pointer h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg"
                />
                <button
                  type="button"
                  onClick={() => setStrokeWidth(Math.min(48, strokeWidth + 1))}
                  className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center text-xs font-bold text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
                  title="Increase thickness by 1px"
                >
                  +
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Color & Stroke Customization Popover */}
        {showSettingsPopover && (
          <div
            ref={settingsRef}
            onPointerDown={(e) => e.stopPropagation()}
            className="mb-2 p-1.5 rounded-[1.75rem] bg-slate-900/5 dark:bg-white/[0.04] border border-slate-200/80 dark:border-white/[0.08] shadow-2xl backdrop-blur-xl ring-1 ring-black/5 dark:ring-white/5 w-80 max-w-[92vw] animate-in fade-in zoom-in-95 z-50 pointer-events-auto"
          >
            <div className="rounded-[1.4rem] bg-white dark:bg-[#0c0e15] border border-slate-200/70 dark:border-white/[0.06] p-4 text-slate-900 dark:text-slate-100 flex flex-col gap-3.5">
            {/* Color Header & Native Color Picker */}
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Color Options
              </span>
              <div className="flex items-center gap-2">
                <div className="relative flex items-center justify-center cursor-pointer">
                  <input
                    type="color"
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    className="absolute inset-0 opacity-0 w-full h-full cursor-pointer z-10"
                    title="Custom Color Picker"
                  />
                  <div className="w-7 h-7 rounded-full border-2 border-slate-300 dark:border-slate-600 shadow-sm flex items-center justify-center bg-gradient-to-tr from-pink-500 via-amber-400 to-indigo-500">
                    <Palette className="w-3.5 h-3.5 text-white drop-shadow-sm pointer-events-none" />
                  </div>
                </div>
                <span className="text-xs font-mono uppercase bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md text-slate-700 dark:text-slate-300">
                  {color}
                </span>
              </div>
            </div>

            {/* 16-color Palette Grid */}
            <div className="grid grid-cols-8 gap-2">
              {EXPANDED_PALETTE.map((c) => {
                const isSelected = color.toLowerCase() === c.hex.toLowerCase();
                return (
                  <button
                    key={c.hex}
                    type="button"
                    onClick={() => setColor(c.hex)}
                    title={c.name}
                    className={`w-7 h-7 rounded-full transition-transform border border-slate-200 dark:border-slate-700 shadow-xs ${
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
                  style={{ width: Math.max(Math.min(strokeWidth, 18), 3), height: Math.max(Math.min(strokeWidth, 18), 3) }}
                />
              </div>

              <div className="grid grid-cols-5 gap-1">
                {STROKE_WIDTHS.map((sw) => (
                  <button
                    key={sw.value}
                    type="button"
                    onClick={() => setStrokeWidth(sw.value)}
                    className={`py-1.5 text-xs rounded-xl font-medium transition-all ${
                      strokeWidth === sw.value
                        ? 'bg-indigo-600 text-white shadow-xs font-semibold'
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
                max="48"
                value={strokeWidth}
                onChange={(e) => setStrokeWidth(Number(e.target.value))}
                onInput={(e) => setStrokeWidth(Number(e.target.value))}
                className="w-full accent-indigo-600 cursor-pointer h-2 bg-slate-200 dark:bg-slate-700 rounded-lg"
              />
            </div>

            {/* Opacity Slider */}
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex flex-col gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Ink Opacity: {Math.round((opacity || 1) * 100)}%
              </span>
              <div className="grid grid-cols-4 gap-1.5">
                {OPACITY_PRESETS.map((op) => (
                  <button
                    key={op.value}
                    type="button"
                    onClick={() => setOpacity(op.value)}
                    className={`py-1.5 text-xs rounded-xl font-medium transition-all ${
                      opacity === op.value
                        ? 'bg-indigo-600 text-white shadow-xs font-semibold'
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
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex flex-col gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Shape Fill
                </span>
                <div className="grid grid-cols-3 gap-1.5">
                  <button
                    type="button"
                    onClick={() => setFillColor('transparent')}
                    className={`py-1.5 text-xs rounded-xl font-medium transition-all ${
                      fillColor === 'transparent'
                        ? 'bg-indigo-600 text-white'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    None
                  </button>
                  <button
                    type="button"
                    onClick={() => setFillColor(color)}
                    className={`py-1.5 text-xs rounded-xl font-medium transition-all ${
                      fillColor === color
                        ? 'bg-indigo-600 text-white'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    Solid
                  </button>
                  <button
                    type="button"
                    onClick={() => setFillColor(color + '33')}
                    className={`py-1.5 text-xs rounded-xl font-medium transition-all ${
                      fillColor?.length === 9
                        ? 'bg-indigo-600 text-white'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    20% Tint
                  </button>
                </div>
              </div>
            )}
            </div>
          </div>
        )}

        {/* Clear Options Popover (Unclipped above toolbar pill) */}
        {showClearMenu && (
          <div
            ref={clearMenuRef}
            onPointerDown={(e) => e.stopPropagation()}
            className="mb-2 p-1.5 rounded-[1.75rem] bg-slate-900/5 dark:bg-white/[0.04] border border-slate-200/80 dark:border-white/[0.08] shadow-2xl backdrop-blur-xl ring-1 ring-black/5 dark:ring-white/5 w-76 max-w-[92vw] z-50 animate-in fade-in zoom-in-95 pointer-events-auto"
          >
            <div className="rounded-[1.4rem] bg-white dark:bg-[#0c0e15] border border-slate-200/70 dark:border-white/[0.06] p-3 text-slate-900 dark:text-slate-100 flex flex-col gap-2">
              <div className="px-2 py-0.5 text-[10px] font-mono font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 flex items-center justify-between">
                <span>Clear Options</span>
                <Trash2 className="w-3.5 h-3.5 text-rose-500" />
              </div>

              <button
                type="button"
                onClick={() => {
                  setShowClearMenu(false);
                  onClear();
                }}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer text-left active:scale-[0.98]"
              >
                <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-500 shrink-0">
                  <Eraser className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-bold text-slate-900 dark:text-slate-100">Clear Current Page</div>
                  <div className="text-[11px] text-slate-400">Erase all drawings, strokes & text notes on this page</div>
                </div>
              </button>

              {onClearNotebook && (
                <button
                  type="button"
                  onClick={() => {
                    setShowClearMenu(false);
                    onClearNotebook();
                  }}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer text-left active:scale-[0.98]"
                >
                  <div className="p-2 rounded-xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 shrink-0">
                    <Trash2 className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-bold text-rose-600 dark:text-rose-400">Clear Notebook Overall</div>
                    <div className="text-[11px] opacity-75">Wipe all pages, drawings & notes in notebook</div>
                  </div>
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Floating Toolbar Pill - Large, Spacious, and Touch/Click Friendly */}
      <div className="pointer-events-auto p-1.5 rounded-[1.75rem] sm:rounded-[2.25rem] bg-slate-900/5 dark:bg-white/[0.04] border border-slate-200/80 dark:border-white/[0.08] shadow-2xl backdrop-blur-2xl ring-1 ring-black/5 dark:ring-white/5 max-w-full">
        <div className="flex items-center gap-1.5 sm:gap-2 p-1.5 sm:p-2 bg-white/95 dark:bg-[#0c0e15]/95 backdrop-blur-xl border border-slate-200/70 dark:border-white/[0.06] rounded-[1.45rem] sm:rounded-[1.95rem] select-none overflow-x-auto no-scrollbar max-w-full touch-pan-x cursor-default">
        
        {/* Mode Selector: Select (Cursor) vs Draw vs Type Note */}
        <div className="flex items-center p-1 bg-slate-100 dark:bg-slate-800/80 rounded-2xl shrink-0">
          <button
            type="button"
            onClick={() => setTool('select')}
            title="Select & Move (V): Standard pointer to select notes, move elements, or click features"
            className={`flex items-center gap-1.5 px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-xl text-xs sm:text-sm font-semibold cursor-pointer active:scale-95 transition-all ${
              tool === 'select'
                ? 'bg-gradient-to-tr from-indigo-600 to-indigo-500 text-white shadow-md shadow-indigo-500/25'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <MousePointer2 className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
            <span className="hidden sm:inline">Select</span>
          </button>

          <button
            type="button"
            onClick={() => {
              if (tool === 'select' || tool === 'text') setTool('pen');
            }}
            title="Draw Mode (P): Draw freehand or geometric shapes"
            className={`flex items-center gap-1.5 px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-xl text-xs sm:text-sm font-semibold cursor-pointer active:scale-95 transition-all ${
              ['pen', 'pencil', 'highlighter', 'rect', 'rectangle', 'circle', 'line', 'arrow'].includes(tool)
                ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Pen className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
            <span className="hidden sm:inline">Draw</span>
          </button>

          <button
            type="button"
            onClick={() => setTool('text')}
            title="Type Note Mode (T): Click anywhere on canvas to write notes"
            className={`flex items-center gap-1.5 px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-xl text-xs sm:text-sm font-semibold cursor-pointer active:scale-95 transition-all ${
              tool === 'text'
                ? 'bg-gradient-to-tr from-indigo-600 to-indigo-500 text-white shadow-md shadow-indigo-500/25'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Type className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
            <span className="hidden sm:inline">Type Note</span>
          </button>
        </div>

        {/* Drawing Tools Group */}
        <div className="flex items-center gap-1 pr-1.5 border-r border-slate-200 dark:border-slate-800 shrink-0">
          <button
            type="button"
            onClick={() => handleSelectTool('pen')}
            title="Pen (Natural Ink)"
            className={`p-2 sm:p-2.5 rounded-xl sm:rounded-2xl cursor-pointer active:scale-95 transition-all ${
              tool === 'pen'
                ? 'bg-gradient-to-tr from-indigo-600 to-indigo-500 text-white shadow-md shadow-indigo-500/25'
                : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Pen className="w-4.5 h-4.5 sm:w-5 sm:h-5" />
          </button>

          <button
            type="button"
            onClick={() => handleSelectTool('pencil')}
            title="Pencil (Graphite Sketch)"
            className={`p-2 sm:p-2.5 rounded-xl sm:rounded-2xl cursor-pointer active:scale-95 transition-all ${
              tool === 'pencil'
                ? 'bg-gradient-to-tr from-indigo-600 to-indigo-500 text-white shadow-md shadow-indigo-500/25'
                : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Pencil className="w-4.5 h-4.5 sm:w-5 sm:h-5" />
          </button>

          <button
            type="button"
            onClick={() => handleSelectTool('highlighter')}
            title="Highlighter"
            className={`p-2 sm:p-2.5 rounded-xl sm:rounded-2xl cursor-pointer active:scale-95 transition-all ${
              tool === 'highlighter'
                ? 'bg-gradient-to-tr from-amber-500 to-amber-400 text-white shadow-md shadow-amber-500/25'
                : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Highlighter className="w-4.5 h-4.5 sm:w-5 sm:h-5" />
          </button>

          <button
            type="button"
            onClick={() => handleSelectTool('eraser')}
            title="Eraser (E - Erase strokes & shapes)"
            className={`p-2 sm:p-2.5 rounded-xl sm:rounded-2xl cursor-pointer active:scale-95 transition-all ${
              tool === 'eraser'
                ? 'bg-gradient-to-tr from-rose-600 to-rose-500 text-white shadow-md shadow-rose-500/25'
                : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Eraser className="w-4.5 h-4.5 sm:w-5 sm:h-5" />
          </button>
        </div>

        {/* Shapes Menu Group */}
        <div ref={shapeBtnRef} className="relative flex items-center pr-1.5 border-r border-slate-200 dark:border-slate-800 shrink-0">
          <div className={`flex items-center rounded-xl sm:rounded-2xl transition-all ${isShapeTool ? 'bg-gradient-to-tr from-indigo-600 to-indigo-500 text-white shadow-md shadow-indigo-500/25' : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => {
                if (!isShapeTool) {
                  setTool(selectedShape);
                } else {
                  togglePopover('shape');
                }
              }}
              title="Shape Tool (Click to draw, arrow to pick shape)"
              className="p-2 sm:p-2.5 pr-0.5 rounded-l-xl sm:rounded-l-2xl flex items-center cursor-pointer active:scale-95"
            >
              <CurrentShapeIcon className="w-4.5 h-4.5 sm:w-5 sm:h-5" />
            </button>
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                togglePopover('shape');
              }}
              title="Choose Shape"
              className="p-2 sm:p-2.5 pl-0.5 pr-2 rounded-r-xl sm:rounded-r-2xl opacity-75 hover:opacity-100 cursor-pointer active:scale-95"
            >
              <ChevronDown className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Pan Hand */}
        <div className="flex items-center pr-1.5 border-r border-slate-200 dark:border-slate-800 shrink-0">
          <button
            type="button"
            onClick={() => setTool('pan')}
            title="Hand / Pan Canvas (H or hold Spacebar)"
            className={`p-2 sm:p-2.5 rounded-xl sm:rounded-2xl cursor-pointer active:scale-95 transition-all ${
              tool === 'pan'
                ? 'bg-gradient-to-tr from-indigo-600 to-indigo-500 text-white shadow-md shadow-indigo-500/25'
                : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Hand className="w-4.5 h-4.5 sm:w-5 sm:h-5" />
          </button>
        </div>

        {/* Dedicated Page Paper Style Trigger on Toolbar */}
        <div ref={paperBtnRef} className="relative flex items-center pr-1.5 border-r border-slate-200 dark:border-slate-800 shrink-0">
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => {
              if (onOpenPaperStyleModal) {
                togglePopover('');
                onOpenPaperStyleModal();
              } else {
                togglePopover('paper');
              }
            }}
            title="Page Paper Style (Dotted, Grid, Ruled, Blank)"
            className={`flex items-center gap-1.5 p-2 sm:px-3 sm:py-2 rounded-xl sm:rounded-2xl cursor-pointer transition-all ${
              showPaperPopover
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Grid className="w-4.5 h-4.5 sm:w-5 sm:h-5 text-indigo-500" />
            <span className="text-xs sm:text-sm font-semibold capitalize hidden md:inline">
              {backgroundType || 'dotted'}
            </span>
            <ChevronDown className="w-3.5 h-3.5 opacity-60" />
          </button>
        </div>

        {/* Direct Quick Color Swatches + Rainbow Multicolor Picker */}
        <div className="flex items-center gap-1.5 px-1 border-r border-slate-200 dark:border-slate-800 shrink-0">
          <div className="hidden lg:flex items-center gap-1.5">
            {QUICK_COLORS.map((c) => {
              const isSelected = color.toLowerCase() === c.toLowerCase();
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  title={`Color: ${c}`}
                  className={`w-6 h-6 sm:w-7 sm:h-7 rounded-full transition-transform border border-slate-300 dark:border-slate-600 shadow-2xs cursor-pointer ${
                    isSelected ? 'scale-125 ring-2 ring-indigo-500 ring-offset-2 dark:ring-offset-slate-900' : 'hover:scale-110'
                  }`}
                  style={{ backgroundColor: c }}
                />
              );
            })}
          </div>

          {/* Rainbow Multicolor Picker Button directly on toolbar */}
          <label
            className="relative flex items-center justify-center cursor-pointer p-0.5"
            title="Custom Color Picker"
          >
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="absolute inset-0 opacity-0 w-full h-full cursor-pointer z-10"
            />
            <div
              className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center border-2 transition-transform shadow-2xs ${
                !QUICK_COLORS.some((c) => c.toLowerCase() === color.toLowerCase())
                  ? 'scale-110 ring-2 ring-indigo-500 ring-offset-2 dark:ring-offset-slate-900 border-white'
                  : 'border-slate-300 dark:border-slate-600 bg-gradient-to-tr from-pink-500 via-amber-400 to-indigo-500 hover:scale-110'
              }`}
              style={{
                backgroundColor: !QUICK_COLORS.some((c) => c.toLowerCase() === color.toLowerCase()) ? color : undefined
              }}
            >
              <Palette className="w-4 h-4 text-white drop-shadow-sm pointer-events-none" />
            </div>
          </label>
        </div>

        {/* Dedicated Stroke Thickness Trigger on Toolbar */}
        <div ref={thicknessBtnRef} className="relative flex items-center pr-1.5 border-r border-slate-200 dark:border-slate-800 shrink-0">
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => {
              togglePopover('thickness');
            }}
            title="Stroke Thickness"
            className={`flex items-center gap-1.5 p-2 sm:px-3 sm:py-2 rounded-xl sm:rounded-2xl cursor-pointer transition-all ${
              showThicknessPopover
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <div
              className={`rounded-full ${showThicknessPopover ? 'bg-white' : 'bg-slate-800 dark:bg-slate-200'}`}
              style={{ width: Math.max(Math.min(strokeWidth, 16), 4), height: Math.max(Math.min(strokeWidth, 16), 4) }}
            />
            <span className="text-xs sm:text-sm font-mono font-bold">{strokeWidth}px</span>
            <ChevronDown className="w-3.5 h-3.5 opacity-60" />
          </button>
        </div>

        {/* Color & Stroke Customization Trigger Button */}
        <div ref={settingsBtnRef} className="relative flex items-center pr-1.5 border-r border-slate-200 dark:border-slate-800 shrink-0">
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => {
              togglePopover('settings');
            }}
            title="Stroke Thickness, Opacity & Fill Options"
            className={`flex items-center gap-1.5 p-2 sm:p-2.5 rounded-xl sm:rounded-2xl cursor-pointer transition-all ${
              showSettingsPopover
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
            }`}
          >
            <span
              className="w-5 h-5 sm:w-6 sm:h-6 rounded-full border-2 border-white dark:border-slate-700 shadow-sm"
              style={{ backgroundColor: color }}
            />
            <Sliders className="w-4 h-4 sm:w-4.5 sm:h-4.5 opacity-80" />
          </button>
        </div>

        {/* Undo / Redo */}
        <div className="flex items-center gap-1 pr-1.5 border-r border-slate-200 dark:border-slate-800 shrink-0">
          <button
            type="button"
            onClick={onUndo}
            disabled={!canEdit || undoStack.length === 0}
            title="Undo (Ctrl+Z)"
            className="p-2 sm:p-2.5 rounded-xl sm:rounded-2xl cursor-pointer text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white disabled:opacity-30 disabled:hover:bg-transparent disabled:cursor-not-allowed transition-colors"
          >
            <Undo2 className="w-4.5 h-4.5 sm:w-5 sm:h-5" />
          </button>

          <button
            type="button"
            onClick={onRedo}
            disabled={!canEdit || redoStack.length === 0}
            title="Redo (Ctrl+Y or Ctrl+Shift+Z)"
            className="p-2 sm:p-2.5 rounded-xl sm:rounded-2xl cursor-pointer text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white disabled:opacity-30 disabled:hover:bg-transparent disabled:cursor-not-allowed transition-colors"
          >
            <Redo2 className="w-4.5 h-4.5 sm:w-5 sm:h-5" />
          </button>
        </div>

        {/* Zoom Controls */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => setZoom(zoom - 0.15)}
            disabled={zoom <= 0.25}
            title="Zoom Out"
            className="p-1.5 sm:p-2 rounded-xl cursor-pointer text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ZoomOut className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={resetView}
            title="Reset View (100%)"
            className="text-xs font-mono font-bold cursor-pointer text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white px-2 py-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 min-w-[42px] text-center transition-colors"
          >
            {Math.round(zoom * 100)}%
          </button>

          <button
            type="button"
            onClick={() => setZoom(zoom + 0.15)}
            disabled={zoom >= 4.0}
            title="Zoom In"
            className="p-1.5 sm:p-2 rounded-xl cursor-pointer text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
        </div>

        {/* Clear Options Trigger - Prominent, Colored and Always Visible */}
        {canEdit && (
          <div ref={clearBtnRef} className="relative pl-1 shrink-0">
            <button
              type="button"
              onClick={() => {
                if (onClearNotebook) {
                  togglePopover('clear');
                } else {
                  togglePopover('');
                  onClear();
                }
              }}
              title="Clear Options: Clear Page or Entire Notebook"
              className={`flex items-center gap-1.5 p-2 sm:px-3 sm:py-2 rounded-xl sm:rounded-2xl cursor-pointer font-semibold text-xs sm:text-sm transition-all ${
                showClearMenu
                  ? 'bg-rose-600 text-white shadow-md'
                  : 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/60 border border-rose-200/80 dark:border-rose-900/50'
              }`}
            >
              <Trash2 className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
              <span>Clear</span>
            </button>
          </div>
        )}
        </div>
      </div>
    </div>
  );
}
