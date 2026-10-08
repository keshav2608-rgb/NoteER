'use client';
import React, { useState, useEffect, useRef } from 'react';
import { Check, X } from 'lucide-react';

const PAPER_OPTIONS = [
  { id: 'dotted', label: 'Dotted', tagline: 'Dots for notes and quick sketches' },
  { id: 'grid', label: 'Grid', tagline: 'Squares for maths, charts and plans' },
  { id: 'ruled', label: 'Ruled', tagline: 'Lines and a margin for handwriting' },
  { id: 'blank', label: 'Blank', tagline: 'Nothing in the way of a drawing' }
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
    <div onClick={handleCancel} className="scrim select-none">
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="paper-style-title"
        className="index-card sm:max-w-lg"
      >
        <div className="index-card-head">
          <div>
            <h2 id="paper-style-title" className="index-card-title">Paper</h2>
            <p className="text-sm text-pencil mt-0.5">Pick the ruling for this page. You’ll see it change behind this card.</p>
          </div>
          <button type="button" onClick={handleCancel} className="icon-btn icon-btn-sm -mr-2" title="Close" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="index-card-body flex flex-col gap-5">
          <div role="radiogroup" aria-label="Paper style" className="grid grid-cols-2 gap-3 sm:gap-4">
            {PAPER_OPTIONS.map((opt) => {
              const isSelected = selectedType === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  onClick={() => handleCardClick(opt.id)}
                  className="group text-left flex flex-col gap-2 cursor-pointer rounded-ctl"
                >
                  {/* A torn-off corner of the real paper */}
                  <div
                    className={`relative w-full aspect-[4/3] rounded-ctl border overflow-hidden transition-shadow canvas-bg-${opt.id} ${
                      isSelected
                        ? 'border-ballpoint ring-2 ring-ballpoint shadow-lift'
                        : 'border-rule group-hover:border-pencil/50'
                    }`}
                  >
                    {opt.id === 'ruled' && (
                      <div className="absolute top-0 bottom-0 left-5 w-px bg-correction/60" />
                    )}
                    {isSelected && (
                      <span className="absolute top-2 right-2 w-6 h-6 rounded-full bg-ballpoint text-ballpoint-fg flex items-center justify-center">
                        <Check className="w-3.5 h-3.5" strokeWidth={3} />
                      </span>
                    )}
                  </div>
                  <div className="px-0.5">
                    <span className={`text-sm font-semibold text-ink ${isSelected ? 'hl px-1.5 -mx-1' : ''}`}>
                      {opt.label}
                    </span>
                    <p className="text-xs text-pencil leading-snug mt-0.5">{opt.tagline}</p>
                  </div>
                </button>
              );
            })}
          </div>

          {pagesCount > 1 && (
            <label className="flex items-center gap-3 cursor-pointer text-sm text-ink">
              <input
                type="checkbox"
                checked={applyToAll}
                onChange={(e) => setApplyToAll(e.target.checked)}
                className="w-4 h-4 rounded accent-[rgb(var(--ballpoint))] cursor-pointer"
              />
              <span>Use on all {pagesCount} pages</span>
            </label>
          )}

          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-4 border-t border-rule">
            <button type="button" onClick={handleCancel} className="btn btn-quiet">
              Cancel
            </button>
            <button type="button" onClick={handleApply} className="btn btn-primary">
              {applyToAll && pagesCount > 1 ? 'Apply to all pages' : 'Apply'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
