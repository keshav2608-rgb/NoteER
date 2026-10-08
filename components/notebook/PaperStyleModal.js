'use client';
import React, { useState, useEffect, useRef } from 'react';
import {
  CircleDot,
  Grid,
  AlignLeft,
  FileText,
  Check,
  X,
  Layers,
  Sparkles,
  ArrowRight
} from 'lucide-react';

const PAPER_OPTIONS = [
  {
    id: 'dotted',
    label: 'Dotted Paper',
    tagline: 'Dot matrix for notes & sketches',
    description: 'Subtle dots spaced evenly for clean diagrams, bullet lists, and geometric layouts without visual clutter.',
    icon: CircleDot
  },
  {
    id: 'grid',
    label: 'Math Grid',
    tagline: 'Precision square grid',
    description: 'Crisp Cartesian grid ideal for calculations, charts, floor plans, and technical wireframing.',
    icon: Grid
  },
  {
    id: 'ruled',
    label: 'Ruled Lined',
    tagline: 'Classic notebook with margin',
    description: 'Standard lined notebook ruling complete with classic left margin guideline for neat handwriting.',
    icon: AlignLeft
  },
  {
    id: 'blank',
    label: 'Blank Canvas',
    tagline: 'Clean infinite white sheet',
    description: 'Pure unmarked sheet without any guidelines or constraints, perfect for freeform art and mindmaps.',
    icon: FileText
  }
];

export default function PaperStyleModal({
  isOpen,
  onClose,
  currentType = 'dotted',
  onSelectType,
  pagesCount = 1,
  darkMode = false
}) {
  const [selectedType, setSelectedType] = useState(currentType || 'dotted');
  const [initialType, setInitialType] = useState(currentType || 'dotted');
  const [applyToAll, setApplyToAll] = useState(false);

  // Snapshot the page's type only when the modal opens. Live previews change
  // currentType while open, and must not overwrite the type to revert to.
  useEffect(() => {
    if (isOpen) {
      setSelectedType(currentType || 'dotted');
      setInitialType(currentType || 'dotted');
      setApplyToAll(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // Keyboard shortcut: Escape to close (via ref so it always sees current state)
  const cancelRef = useRef(null);
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        cancelRef.current?.();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  if (!isOpen) return null;

  const handleApply = () => {
    if (onSelectType) {
      onSelectType(selectedType, applyToAll);
    }
    onClose();
  };

  const handleCancel = () => {
    // Revert to initial type if live preview altered it
    if (selectedType !== initialType && onSelectType) {
      onSelectType(initialType, false);
    }
    onClose();
  };
  cancelRef.current = handleCancel;

  const handleCardClick = (typeId) => {
    setSelectedType(typeId);
    if (!applyToAll && onSelectType) {
      // Instant live preview update
      onSelectType(typeId, false);
    }
  };

  return (
    <div
      onClick={handleCancel}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/60 backdrop-blur-md animate-in fade-in select-none"
    >
      {/* Outer Shell: Double-bezel hardware styling */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative bg-slate-100/90 dark:bg-slate-800/90 p-2 rounded-[2rem] border border-slate-200/90 dark:border-slate-700/80 shadow-2xl max-w-lg w-full ring-1 ring-black/5 dark:ring-white/10 animate-in zoom-in-95 duration-200"
      >
        {/* Inner Core: Machined card surface */}
        <div className="bg-white/98 dark:bg-slate-900/98 rounded-[calc(2rem-0.5rem)] p-5 sm:p-6 flex flex-col gap-5 text-slate-900 dark:text-slate-100 shadow-[inset_0_1px_1px_rgba(255,255,255,0.2)] max-h-[85vh] overflow-y-auto no-scrollbar">
          
          {/* Header Bar */}
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-2xl bg-indigo-50 dark:bg-indigo-950/70 border border-indigo-200/80 dark:border-indigo-800/60 text-indigo-600 dark:text-indigo-400 shadow-sm">
                <Grid className="w-5 h-5 sm:w-6 sm:h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] uppercase font-bold tracking-widest text-indigo-600 dark:text-indigo-400 px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200/60 dark:border-indigo-800/60">
                    PAPER ARCHITECTURE
                  </span>
                </div>
                <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white mt-0.5">
                  Page Paper Style
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Select the background ruling and grid structure for your page
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleCancel}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              title="Close (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Interactive Paper Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {PAPER_OPTIONS.map((opt) => {
              const Icon = opt.icon;
              const isSelected = selectedType === opt.id;

              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => handleCardClick(opt.id)}
                  className={`relative text-left rounded-2xl p-3 border-2 transition-all flex flex-col gap-2.5 cursor-pointer group active:scale-[0.98] ${
                    isSelected
                      ? 'border-indigo-600 dark:border-indigo-500 bg-indigo-50/70 dark:bg-indigo-950/50 shadow-md ring-2 ring-indigo-500/20'
                      : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-slate-50/60 dark:bg-slate-800/40 hover:bg-slate-50 dark:hover:bg-slate-800/70'
                  }`}
                >
                  {/* High-Fidelity Pattern Preview Surface */}
                  <div
                    className={`w-full h-22 rounded-xl border relative overflow-hidden flex items-center justify-center transition-colors ${
                      darkMode ? 'bg-slate-950 border-slate-800' : 'bg-white border-slate-200/90'
                    }`}
                  >
                    {/* Dotted pattern preview */}
                    {opt.id === 'dotted' && (
                      <div
                        className="absolute inset-0 opacity-80"
                        style={{
                          backgroundImage: `radial-gradient(circle, ${darkMode ? '#94a3b8' : '#64748b'} 1.3px, transparent 1.3px)`,
                          backgroundSize: '14px 14px',
                          backgroundPosition: '7px 7px'
                        }}
                      />
                    )}

                    {/* Math Grid pattern preview */}
                    {opt.id === 'grid' && (
                      <div
                        className="absolute inset-0 opacity-80"
                        style={{
                          backgroundImage: `linear-gradient(to right, ${darkMode ? '#334155' : '#cbd5e1'} 1px, transparent 1px), linear-gradient(to bottom, ${darkMode ? '#334155' : '#cbd5e1'} 1px, transparent 1px)`,
                          backgroundSize: '14px 14px'
                        }}
                      />
                    )}

                    {/* Ruled lined pattern preview with red vertical margin line */}
                    {opt.id === 'ruled' && (
                      <div className="absolute inset-0">
                        <div
                          className="absolute inset-0 opacity-80"
                          style={{
                            backgroundImage: `linear-gradient(to bottom, ${darkMode ? '#334155' : '#cbd5e1'} 1px, transparent 1px)`,
                            backgroundSize: '100% 16px',
                            backgroundPosition: '0 8px'
                          }}
                        />
                        <div className="absolute top-0 bottom-0 left-6 w-[2px] bg-rose-500/70 shadow-xs" />
                      </div>
                    )}

                    {/* Blank canvas preview */}
                    {opt.id === 'blank' && (
                      <div className="flex flex-col items-center justify-center text-slate-400 dark:text-slate-600 gap-1.5">
                        <Sparkles className="w-4 h-4 opacity-60" />
                        <span className="text-[10px] font-medium tracking-wide">Pure Clean Canvas</span>
                      </div>
                    )}

                    {/* Corner Icon Pill */}
                    <div className="absolute bottom-2 right-2 p-1.5 rounded-lg bg-white/95 dark:bg-slate-900/95 shadow-md text-slate-600 dark:text-slate-300 border border-slate-100 dark:border-slate-800">
                      <Icon className="w-3.5 h-3.5" />
                    </div>
                  </div>

                  {/* Card Label & Status */}
                  <div className="flex items-start justify-between gap-1">
                    <div>
                      <h3 className={`text-xs font-bold leading-tight ${isSelected ? 'text-indigo-900 dark:text-indigo-200' : 'text-slate-900 dark:text-white'}`}>
                        {opt.label}
                      </h3>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug mt-0.5">
                        {opt.tagline}
                      </p>
                    </div>
                    {isSelected && (
                      <div className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                        <Check className="w-3 h-3 stroke-[3]" />
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Scope: Apply across all pages in notebook */}
          {pagesCount > 1 && (
            <label className="flex items-center gap-3 px-3.5 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-850 border border-slate-200/80 dark:border-slate-800 cursor-pointer transition-colors hover:bg-slate-100/70 dark:hover:bg-slate-800">
              <input
                type="checkbox"
                checked={applyToAll}
                onChange={(e) => setApplyToAll(e.target.checked)}
                className="w-4 h-4 rounded accent-indigo-600 cursor-pointer"
              />
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
                <Layers className="w-3.5 h-3.5 text-indigo-500" />
                <span>Apply this style to all {pagesCount} pages in this notebook</span>
              </div>
            </label>
          )}

          {/* Modal Action Buttons: Button-in-Button Architecture */}
          <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={handleCancel}
              className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleApply}
              className="group pl-4 pr-2 py-1.5 rounded-full text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg transition-all flex items-center gap-2.5 cursor-pointer active:scale-[0.98]"
            >
              <span>Apply Paper Style</span>
              <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center transition-transform group-hover:translate-x-0.5">
                <Check className="w-3.5 h-3.5 stroke-[3]" />
              </div>
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}
