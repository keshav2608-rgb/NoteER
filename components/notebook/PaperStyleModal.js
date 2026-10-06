'use client';
import React, { useState } from 'react';
import {
  CircleDot,
  Grid,
  AlignLeft,
  FileText,
  Check,
  X,
  Layers,
  Sparkles
} from 'lucide-react';

const PAPER_OPTIONS = [
  {
    id: 'dotted',
    label: 'Dotted Paper',
    tagline: 'Dot matrix for notes & sketches',
    description: 'Subtle dots spaced evenly for clean diagrams, bullet lists, and geometric layouts without visual clutter.',
    icon: CircleDot,
    previewType: 'dotted'
  },
  {
    id: 'grid',
    label: 'Math Grid',
    tagline: 'Precision square grid',
    description: 'Crisp Cartesian grid ideal for calculations, charts, floor plans, and technical wireframing.',
    icon: Grid,
    previewType: 'grid'
  },
  {
    id: 'ruled',
    label: 'Ruled Lined',
    tagline: 'Classic notebook with margin',
    description: 'Standard lined notebook ruling complete with classic left margin guideline for neat handwriting.',
    icon: AlignLeft,
    previewType: 'ruled'
  },
  {
    id: 'blank',
    label: 'Blank Canvas',
    tagline: 'Clean infinite white sheet',
    description: 'Pure unmarked sheet without any guidelines or constraints, perfect for freeform art and mindmaps.',
    icon: FileText,
    previewType: 'blank'
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
  const [applyToAll, setApplyToAll] = useState(false);

  // Sync when opened
  React.useEffect(() => {
    if (isOpen) {
      setSelectedType(currentType || 'dotted');
    }
  }, [isOpen, currentType]);

  if (!isOpen) return null;

  const handleApply = () => {
    if (onSelectType) {
      onSelectType(selectedType, applyToAll);
    }
    onClose();
  };

  const handleCardClick = (typeId) => {
    setSelectedType(typeId);
    if (!applyToAll && onSelectType) {
      // Instant live preview / update
      onSelectType(typeId, false);
    }
  };

  return (
    <div
      onPointerDown={(e) => e.stopPropagation()}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in select-none"
    >
      <div
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 sm:p-6 shadow-2xl max-w-lg w-full flex flex-col gap-4 sm:gap-5 text-slate-900 dark:text-slate-100 max-h-[90vh] overflow-y-auto no-scrollbar animate-in zoom-in-95"
      >
        {/* Modal Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200/80 dark:border-indigo-800/60 text-indigo-600 dark:text-indigo-400">
              <Grid className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span>Page Paper Style</span>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300">
                  Dialog
                </span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Choose the background ruling and grid pattern for your notebook
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Paper Style Interactive Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {PAPER_OPTIONS.map((opt) => {
            const Icon = opt.icon;
            const isSelected = selectedType === opt.id;

            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => handleCardClick(opt.id)}
                className={`relative group text-left rounded-2xl p-3.5 border-2 transition-all flex flex-col gap-2.5 cursor-pointer ${
                  isSelected
                    ? 'border-indigo-600 dark:border-indigo-500 bg-indigo-50/70 dark:bg-indigo-950/50 shadow-md ring-2 ring-indigo-500/20'
                    : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-slate-50/50 dark:bg-slate-850 hover:bg-slate-50 dark:hover:bg-slate-800/80'
                }`}
              >
                {/* Visual Sheet Preview Box */}
                <div
                  className={`w-full h-20 rounded-xl border relative overflow-hidden flex items-center justify-center transition-colors ${
                    darkMode ? 'bg-slate-950 border-slate-800' : 'bg-white border-slate-200'
                  }`}
                >
                  {/* Miniature rendered pattern */}
                  {opt.id === 'dotted' && (
                    <div
                      className="absolute inset-0 opacity-80"
                      style={{
                        backgroundImage: `radial-gradient(circle, ${darkMode ? '#94a3b8' : '#64748b'} 1.2px, transparent 1.2px)`,
                        backgroundSize: '14px 14px',
                        backgroundPosition: '7px 7px'
                      }}
                    />
                  )}

                  {opt.id === 'grid' && (
                    <div
                      className="absolute inset-0 opacity-80"
                      style={{
                        backgroundImage: `linear-gradient(to right, ${darkMode ? '#475569' : '#cbd5e1'} 1px, transparent 1px), linear-gradient(to bottom, ${darkMode ? '#475569' : '#cbd5e1'} 1px, transparent 1px)`,
                        backgroundSize: '14px 14px'
                      }}
                    />
                  )}

                  {opt.id === 'ruled' && (
                    <div className="absolute inset-0">
                      <div
                        className="absolute inset-0 opacity-80"
                        style={{
                          backgroundImage: `linear-gradient(to bottom, ${darkMode ? '#475569' : '#cbd5e1'} 1px, transparent 1px)`,
                          backgroundSize: '100% 16px',
                          backgroundPosition: '0 8px'
                        }}
                      />
                      {/* Left red margin line */}
                      <div className="absolute top-0 bottom-0 left-6 w-[2px] bg-rose-500/60" />
                    </div>
                  )}

                  {opt.id === 'blank' && (
                    <div className="flex flex-col items-center justify-center text-slate-400 dark:text-slate-600 gap-1">
                      <Sparkles className="w-4 h-4 opacity-50" />
                      <span className="text-[10px] font-medium tracking-wide">Pure Canvas</span>
                    </div>
                  )}

                  {/* Corner icon pill */}
                  <div className="absolute bottom-1.5 right-1.5 p-1 rounded-md bg-white/90 dark:bg-slate-900/90 shadow-2xs text-slate-500 dark:text-slate-400">
                    <Icon className="w-3.5 h-3.5" />
                  </div>
                </div>

                {/* Details */}
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
                    <div className="w-4 h-4 rounded-full bg-indigo-600 text-white flex items-center justify-center shrink-0">
                      <Check className="w-2.5 h-2.5 stroke-[3]" />
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Scope Option: Apply to All Pages in Notebook */}
        {pagesCount > 1 && (
          <label className="flex items-center gap-2.5 px-3 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800 cursor-pointer">
            <input
              type="checkbox"
              checked={applyToAll}
              onChange={(e) => setApplyToAll(e.target.checked)}
              className="w-4 h-4 rounded accent-indigo-600 cursor-pointer"
            />
            <div className="flex items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-300">
              <Layers className="w-3.5 h-3.5 text-indigo-500" />
              <span>Apply this paper style to all {pagesCount} pages in this notebook</span>
            </div>
          </label>
        )}

        {/* Modal Actions */}
        <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-100 dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleApply}
            className="px-5 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-md transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <Check className="w-3.5 h-3.5" />
            <span>Apply Paper Style</span>
          </button>
        </div>
      </div>
    </div>
  );
}
