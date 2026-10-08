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
  Sliders,
  ChevronDown,
  Grid,
  CircleDot,
  AlignLeft,
  FileText,
  Plus
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
  const isCustomColor = !QUICK_COLORS.some((c) => c.toLowerCase() === (color || '').toLowerCase());
  const previewColor = color === '#ffffff' || color === '#f8fafc' ? (darkMode ? '#ffffff' : '#0f172a') : color;

  // Publish the tray height so floating UI (minimap etc.) can sit above it
  const trayRef = useRef(null);
  useEffect(() => {
    const el = trayRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => {
      document.documentElement.style.setProperty('--tray-h', `${el.offsetHeight}px`);
    });
    ro.observe(el);
    return () => {
      ro.disconnect();
      document.documentElement.style.removeProperty('--tray-h');
    };
  }, []);

  return (
    <div
      className="fixed z-30 inset-x-2 sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2 flex flex-col items-center gap-2 pointer-events-none"
      style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 10px)' }}
    >
      {/* Popovers sit directly above the tray, never clipped by its scroller */}
      <div className="pointer-events-auto flex flex-col items-center w-full sm:w-auto">
        {showPaperPopover && (
          <div ref={paperPopoverRef} onPointerDown={(e) => e.stopPropagation()} className={POPOVER}>
            <PopoverHeading label="Paper" value={backgroundType || 'dotted'} />
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
                    aria-pressed={isSelected}
                    className={`p-2.5 rounded-ctl border text-left flex flex-col gap-1 cursor-pointer transition-colors ${
                      isSelected ? 'border-ink bg-paper-2' : 'border-rule hover:bg-paper-2'
                    }`}
                  >
                    <span className="flex items-center gap-1.5 text-sm font-semibold text-ink">
                      <Icon className="w-4 h-4 text-pencil" />
                      <span className={isSelected ? 'hl-under' : ''}>{style.label}</span>
                    </span>
                    <span className="text-xs text-pencil leading-snug">{style.desc}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {showShapePicker && (
          <div
            ref={shapePickerRef}
            onPointerDown={(e) => e.stopPropagation()}
            className="menu mb-2 flex items-center gap-1 max-w-[calc(100vw-16px)]"
          >
            {SHAPE_TOOLS.map((s) => {
              const Icon = s.icon;
              const isActive = isShapeTool ? (tool === s.id || (tool === 'rectangle' && s.id === 'rect')) : selectedShape === s.id;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => {
                    setSelectedShape(s.id);
                    setTool(s.id);
                    setShowShapePicker(false);
                  }}
                  title={s.label}
                  aria-pressed={isActive}
                  className={`flex items-center gap-1.5 h-10 px-3 rounded-ctl text-sm cursor-pointer transition-colors ${
                    isActive ? ACTIVE : 'text-ink hover:bg-paper-2'
                  }`}
                  style={isActive ? HL_RADIUS : undefined}
                >
                  <Icon className="w-4 h-4" />
                  <span className="hidden sm:inline">{s.label}</span>
                </button>
              );
            })}
          </div>
        )}

        {showThicknessPopover && (
          <div ref={thicknessRef} onPointerDown={(e) => e.stopPropagation()} className={POPOVER}>
            <PopoverHeading label="Thickness" value={`${strokeWidth}px`} />
            <StrokePreview width={strokeWidth} color={previewColor} />
            <div className="grid grid-cols-5 gap-1.5">
              {STROKE_WIDTHS.map((sw) => (
                <button
                  key={sw.value}
                  type="button"
                  onClick={() => setStrokeWidth(sw.value)}
                  aria-pressed={strokeWidth === sw.value}
                  className={`${choiceClass(strokeWidth === sw.value)} flex flex-col items-center justify-center h-11`}
                >
                  <span className="text-xs font-semibold tabular-nums leading-none">{sw.value}px</span>
                  <span className="text-[11px] opacity-75 mt-1 leading-none">{sw.label}</span>
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setStrokeWidth(Math.max(1, strokeWidth - 1))}
                className="icon-btn icon-btn-sm bg-paper-2 text-ink"
                title="Thinner"
                aria-label="Thinner"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>
              <input
                type="range"
                min="1"
                max="48"
                value={strokeWidth}
                onChange={(e) => setStrokeWidth(Number(e.target.value))}
                aria-label="Stroke thickness"
                className="w-full accent-ballpoint cursor-pointer"
              />
              <button
                type="button"
                onClick={() => setStrokeWidth(Math.min(48, strokeWidth + 1))}
                className="icon-btn icon-btn-sm bg-paper-2 text-ink"
                title="Thicker"
                aria-label="Thicker"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {showSettingsPopover && (
          <div ref={settingsRef} onPointerDown={(e) => e.stopPropagation()} className={POPOVER}>
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-ink">Colour</span>
              <label className="relative flex items-center gap-2 cursor-pointer text-sm text-pencil" title="Pick any colour">
                <input
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                  aria-label="Custom colour"
                />
                <span className="tabular-nums">{color}</span>
                <span className="w-7 h-7 rounded-full border border-ink/15" style={{ background: COLOR_WHEEL }} />
              </label>
            </div>

            <div className="grid grid-cols-8 gap-2 justify-items-center">
              {EXPANDED_PALETTE.map((c) => (
                <Swatch
                  key={c.hex}
                  hex={c.hex}
                  title={c.name}
                  selected={(color || '').toLowerCase() === c.hex.toLowerCase()}
                  onClick={() => setColor(c.hex)}
                />
              ))}
            </div>

            <div className="pt-3 border-t border-rule flex flex-col gap-2">
              <PopoverHeading label="Thickness" value={`${strokeWidth}px`} />
              <div className="grid grid-cols-5 gap-1.5">
                {STROKE_WIDTHS.map((sw) => (
                  <button
                    key={sw.value}
                    type="button"
                    onClick={() => setStrokeWidth(sw.value)}
                    aria-pressed={strokeWidth === sw.value}
                    className={`${choiceClass(strokeWidth === sw.value)} h-9 text-xs`}
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
                aria-label="Stroke thickness"
                className="w-full accent-ballpoint cursor-pointer"
              />
            </div>

            <div className="pt-3 border-t border-rule flex flex-col gap-2">
              <PopoverHeading label="Ink opacity" value={`${Math.round((opacity || 1) * 100)}%`} />
              <div className="grid grid-cols-4 gap-1.5">
                {OPACITY_PRESETS.map((op) => (
                  <button
                    key={op.value}
                    type="button"
                    onClick={() => setOpacity(op.value)}
                    aria-pressed={opacity === op.value}
                    className={`${choiceClass(opacity === op.value)} h-9 text-xs tabular-nums`}
                  >
                    {op.label}
                  </button>
                ))}
              </div>
            </div>

            {isShapeTool && (
              <div className="pt-3 border-t border-rule flex flex-col gap-2">
                <span className="text-sm font-semibold text-ink">Shape fill</span>
                <div className="grid grid-cols-3 gap-1.5">
                  <button
                    type="button"
                    onClick={() => setFillColor('transparent')}
                    className={`${choiceClass(fillColor === 'transparent')} h-9 text-xs`}
                  >
                    None
                  </button>
                  <button
                    type="button"
                    onClick={() => setFillColor(color)}
                    className={`${choiceClass(fillColor === color)} h-9 text-xs`}
                  >
                    Solid
                  </button>
                  <button
                    type="button"
                    onClick={() => setFillColor(color + '33')}
                    className={`${choiceClass(fillColor?.length === 9)} h-9 text-xs`}
                  >
                    20% tint
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {showClearMenu && (
          <div
            ref={clearMenuRef}
            onPointerDown={(e) => e.stopPropagation()}
            className="menu mb-2 w-[min(19rem,calc(100vw-16px))]"
          >
            <button
              type="button"
              onClick={() => {
                setShowClearMenu(false);
                onClear();
              }}
              className="menu-item h-auto py-2.5 items-start"
            >
              <Eraser className="w-4 h-4 mt-0.5 text-pencil shrink-0" />
              <span>
                <span className="block font-semibold">Clear this page</span>
                <span className="block text-xs text-pencil mt-0.5">Erases drawings and notes on this page</span>
              </span>
            </button>
            {onClearNotebook && (
              <button
                type="button"
                onClick={() => {
                  setShowClearMenu(false);
                  onClearNotebook();
                }}
                className="menu-item h-auto py-2.5 items-start text-correction hover:bg-correction/10"
              >
                <Trash2 className="w-4 h-4 mt-0.5 shrink-0" />
                <span>
                  <span className="block font-semibold">Clear whole notebook</span>
                  <span className="block text-xs opacity-80 mt-0.5">Erases every page, drawing and note</span>
                </span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* The tray: one row on wide screens, two rows (tools / properties) on phones */}
      <div
        ref={trayRef}
        className="pointer-events-auto panel w-full sm:w-auto max-w-[calc(100vw-16px)] p-1.5 flex flex-col lg:flex-row lg:items-center select-none cursor-default"
      >
        {/* Row A: what you're doing */}
        <div className="flex items-center scroll-x [&>:first-child]:ml-auto [&>:last-child]:mr-auto lg:[&>:first-child]:ml-0 lg:[&>:last-child]:mr-0">
          <ToolButton active={tool === 'select'} onClick={() => setTool('select')} title="Select and move (V)">
            <MousePointer2 className="w-[18px] h-[18px]" />
          </ToolButton>
          <ToolButton active={tool === 'text'} onClick={() => setTool('text')} title="Add a text note (T)">
            <Type className="w-[18px] h-[18px]" />
          </ToolButton>

          <Divider />

          <ToolButton active={tool === 'pen'} onClick={() => handleSelectTool('pen')} title="Pen (P)">
            <Pen className="w-[18px] h-[18px]" />
          </ToolButton>
          <ToolButton active={tool === 'pencil'} onClick={() => handleSelectTool('pencil')} title="Pencil">
            <Pencil className="w-[18px] h-[18px]" />
          </ToolButton>
          <ToolButton active={tool === 'highlighter'} onClick={() => handleSelectTool('highlighter')} title="Highlighter">
            <Highlighter className="w-[18px] h-[18px]" />
          </ToolButton>
          <ToolButton active={tool === 'eraser'} onClick={() => handleSelectTool('eraser')} title="Eraser (E)">
            <Eraser className="w-[18px] h-[18px]" />
          </ToolButton>

          <Divider />

          <div
            ref={shapeBtnRef}
            className={`flex items-center h-10 shrink-0 rounded-ctl transition-colors ${
              isShapeTool ? ACTIVE : 'text-ink/75 hover:bg-paper-2 hover:text-ink'
            }`}
            style={isShapeTool ? HL_RADIUS : undefined}
          >
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
              title="Shapes"
              aria-label="Shapes"
              aria-pressed={isShapeTool}
              className="h-10 pl-2.5 pr-0.5 flex items-center cursor-pointer"
            >
              <CurrentShapeIcon className="w-[18px] h-[18px]" />
            </button>
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                togglePopover('shape');
              }}
              title="Choose a shape"
              aria-label="Choose a shape"
              aria-expanded={showShapePicker}
              className="h-10 pl-0.5 pr-2 flex items-center cursor-pointer opacity-70 hover:opacity-100"
            >
              <ChevronDown className="w-3.5 h-3.5" />
            </button>
          </div>

          <ToolButton active={tool === 'pan'} onClick={() => setTool('pan')} title="Move around the page (H, or hold Space)">
            <Hand className="w-[18px] h-[18px]" />
          </ToolButton>
        </div>

        <Divider className="hidden lg:block" />

        {/* Row B: how it looks, and page actions */}
        <div className="flex items-center scroll-x [&>:first-child]:ml-auto [&>:last-child]:mr-auto lg:[&>:first-child]:ml-0 lg:[&>:last-child]:mr-0 border-t border-rule mt-1 pt-1 lg:border-0 lg:mt-0 lg:pt-0">
          <div ref={paperBtnRef} className="shrink-0">
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
              title="Paper style"
              aria-label="Paper style"
              className={`icon-btn w-auto min-w-10 px-2.5 gap-1.5 text-ink/75 ${showPaperPopover ? 'bg-paper-2 text-ink' : ''}`}
            >
              <PaperIcon type={backgroundType} />
              <span className="hidden xl:inline text-sm capitalize">{backgroundType || 'dotted'}</span>
            </button>
          </div>

          <Divider />

          <div className="hidden xl:flex items-center gap-1.5 px-1.5 shrink-0">
            {QUICK_COLORS.map((c) => (
              <Swatch
                key={c}
                hex={c}
                title={`Ink ${c}`}
                selected={(color || '').toLowerCase() === c.toLowerCase()}
                onClick={() => setColor(c)}
              />
            ))}
            <label
              className={`relative w-7 h-7 rounded-full cursor-pointer border border-ink/15 shrink-0 ${
                isCustomColor ? 'ring-2 ring-ink ring-offset-2 ring-offset-paper' : ''
              }`}
              style={{ background: isCustomColor ? color : COLOR_WHEEL }}
              title="Pick any colour"
            >
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                aria-label="Custom colour"
              />
            </label>
          </div>

          <div ref={settingsBtnRef} className="shrink-0">
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => togglePopover('settings')}
              title="Colour, thickness and opacity"
              aria-label="Colour, thickness and opacity"
              aria-expanded={showSettingsPopover}
              className={`icon-btn w-auto px-2 gap-1.5 text-ink/75 ${showSettingsPopover ? 'bg-paper-2 text-ink' : ''}`}
            >
              <span
                className="w-[22px] h-[22px] rounded-full border border-ink/20"
                style={{ backgroundColor: color, opacity: opacity || 1 }}
              />
              <Sliders className="hidden sm:block w-4 h-4" />
            </button>
          </div>

          <div ref={thicknessBtnRef} className="hidden md:block shrink-0">
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => togglePopover('thickness')}
              title="Thickness"
              aria-label="Thickness"
              aria-expanded={showThicknessPopover}
              className={`icon-btn w-auto px-2.5 gap-2 text-ink/75 ${showThicknessPopover ? 'bg-paper-2 text-ink' : ''}`}
            >
              <span className="w-4 flex items-center justify-center">
                <span
                  className="rounded-full bg-ink"
                  style={{ width: Math.max(Math.min(strokeWidth, 16), 3), height: Math.max(Math.min(strokeWidth, 16), 3) }}
                />
              </span>
              <span className="text-sm tabular-nums">{strokeWidth}px</span>
            </button>
          </div>

          <Divider />

          <ToolButton onClick={onUndo} disabled={!canEdit || undoStack.length === 0} title="Undo (Ctrl+Z)">
            <Undo2 className="w-[18px] h-[18px]" />
          </ToolButton>
          <ToolButton onClick={onRedo} disabled={!canEdit || redoStack.length === 0} title="Redo (Ctrl+Y)">
            <Redo2 className="w-[18px] h-[18px]" />
          </ToolButton>

          <Divider />

          <ToolButton onClick={() => setZoom(zoom - 0.15)} disabled={zoom <= 0.25} title="Zoom out">
            <ZoomOut className="w-4 h-4" />
          </ToolButton>
          <button
            type="button"
            onClick={resetView}
            title="Reset zoom to 100%"
            className="h-10 min-w-[2.75rem] px-1 rounded-ctl text-sm tabular-nums text-ink hover:bg-paper-2 cursor-pointer transition-colors shrink-0"
          >
            {Math.round(zoom * 100)}%
          </button>
          <ToolButton onClick={() => setZoom(zoom + 0.15)} disabled={zoom >= 4.0} title="Zoom in">
            <ZoomIn className="w-4 h-4" />
          </ToolButton>

          {canEdit && (
            <>
              <Divider />
              <div ref={clearBtnRef} className="shrink-0">
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
                  title="Clear page or notebook"
                  aria-label="Clear page or notebook"
                  aria-expanded={showClearMenu}
                  className={`icon-btn w-auto min-w-10 px-2 gap-1.5 text-correction hover:text-correction hover:bg-correction/10 ${
                    showClearMenu ? 'bg-correction/10' : ''
                  }`}
                >
                  <Trash2 className="w-[18px] h-[18px]" />
                  <span className="hidden xl:inline text-sm font-semibold">Clear</span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// Highlighter swipe for the active tool: irregular corners read as a marker stroke
const HL_RADIUS = { borderRadius: '3px 9px 4px 10px / 9px 4px 10px 3px' };
const ACTIVE = 'bg-highlight text-highlight-fg hover:bg-highlight hover:text-highlight-fg';
const POPOVER = 'menu mb-2 p-3 w-[min(20rem,calc(100vw-16px))] flex flex-col gap-3';
const COLOR_WHEEL = 'conic-gradient(#e11d48, #f59e0b, #facc15, #22c55e, #06b6d4, #2563eb, #9333ea, #e11d48)';

function choiceClass(active) {
  return `rounded-ctl font-medium transition-colors cursor-pointer ${
    active ? 'bg-highlight text-highlight-fg font-semibold' : 'bg-paper-2 text-ink hover:bg-rule/70'
  }`;
}

function ToolButton({ active = false, title, className = '', children, ...rest }) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      aria-pressed={active}
      className={`icon-btn ${active ? ACTIVE : 'text-ink/75'} ${className}`}
      style={active ? HL_RADIUS : undefined}
      {...rest}
    >
      {children}
    </button>
  );
}

function Divider({ className = '' }) {
  return <span aria-hidden="true" className={`w-px h-6 bg-rule mx-0.5 sm:mx-1 shrink-0 ${className}`} />;
}

function Swatch({ hex, title, selected, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={title}
      aria-pressed={selected}
      className={`w-7 h-7 rounded-full border border-ink/15 cursor-pointer shrink-0 transition-transform ${
        selected ? 'ring-2 ring-ink ring-offset-2 ring-offset-paper' : 'hover:scale-110'
      }`}
      style={{ backgroundColor: hex }}
    />
  );
}

function PopoverHeading({ label, value }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm font-semibold text-ink">{label}</span>
      <span className="text-sm text-pencil tabular-nums capitalize">{value}</span>
    </div>
  );
}

function StrokePreview({ width, color }) {
  return (
    <div className="w-full h-10 bg-paper-2 rounded-ctl flex items-center px-4 overflow-hidden">
      <div
        className="w-full rounded-full"
        style={{ height: `${Math.max(1, Math.min(width, 28))}px`, backgroundColor: color }}
      />
    </div>
  );
}

function PaperIcon({ type }) {
  const Icon = PAPER_STYLES.find((p) => p.id === (type || 'dotted'))?.icon || CircleDot;
  return <Icon className="w-[18px] h-[18px]" />;
}
