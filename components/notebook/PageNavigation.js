'use client';
import React, { useState } from 'react';
import { useNotebookStore } from '@/lib/store/useNotebookStore';
import {
  Plus,
  Copy,
  Trash2,
  Grid,
  FileText,
  AlignLeft,
  CircleDot,
  MoreVertical,
  ChevronDown
} from 'lucide-react';

export default function PageNavigation({
  pages = [],
  activePageId,
  onSelectPage,
  onCreatePage,
  onUpdatePage,
  onDeletePage,
  canEdit = true,
  onOpenPaperStyleModal
}) {
  const [editingTitleId, setEditingTitleId] = useState(null);
  const [tempTitle, setTempTitle] = useState('');
  const [showBgMenu, setShowBgMenu] = useState(false);

  const activePage = pages.find((p) => p.id === activePageId) || pages[0];

  const handleStartRename = (page, e) => {
    e.stopPropagation();
    setEditingTitleId(page.id);
    setTempTitle(page.title);
  };

  const handleFinishRename = (pageId) => {
    if (tempTitle.trim()) {
      onUpdatePage(pageId, { title: tempTitle.trim() });
    }
    setEditingTitleId(null);
  };

  const backgrounds = [
    { type: 'blank', label: 'Blank', icon: <FileText className="w-3.5 h-3.5" /> },
    { type: 'ruled', label: 'Ruled', icon: <AlignLeft className="w-3.5 h-3.5" /> },
    { type: 'grid', label: 'Grid', icon: <Grid className="w-3.5 h-3.5" /> },
    { type: 'dotted', label: 'Dotted', icon: <CircleDot className="w-3.5 h-3.5" /> }
  ];

  return (
    <div className="flex items-center gap-1.5 sm:gap-2 bg-paper px-2 sm:px-2.5 py-1.5 rounded-panel border border-rule shadow-lift text-ink">
      {/* Pages Tabs */}
      <div className="flex items-center gap-1 overflow-x-auto max-w-[160px] sm:max-w-xs md:max-w-md no-scrollbar">
        {pages.map((p) => {
          const isActive = p.id === activePageId;
          const isEditing = editingTitleId === p.id;

          return (
            <div
              key={p.id}
              onClick={() => onSelectPage(p.id)}
              className={`group relative flex items-center gap-1.5 px-2.5 sm:px-3 py-1 rounded-ctl text-sm cursor-pointer transition-colors ${
                isActive
                  ? 'hl font-semibold'
                  : 'text-pencil hover:text-ink hover:bg-paper-2'
              }`}
            >
              {isEditing ? (
                <input
                  type="text"
                  value={tempTitle}
                  autoFocus
                  onChange={(e) => setTempTitle(e.target.value)}
                  onBlur={() => handleFinishRename(p.id)}
                  onKeyDown={(e) => e.key === 'Enter' && handleFinishRename(p.id)}
                  className="field h-7 w-24 px-1.5 text-sm"
                />
              ) : (
                <span
                  onDoubleClick={(e) => canEdit && handleStartRename(p, e)}
                  title="Double click to rename"
                  className="truncate max-w-[90px] sm:max-w-[110px]"
                >
                  {p.title}
                </span>
              )}

              {isActive && canEdit && pages.length > 1 && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm(`Delete ${p.title}?`)) onDeletePage(p.id);
                  }}
                  title="Delete page"
                  className="opacity-0 group-hover:opacity-100 hover:text-correction p-0.5 rounded transition-opacity"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Add Page Button */}
      {canEdit && (
        <button
          type="button"
          onClick={onCreatePage}
          title="Add New Page"
          className="btn btn-sm btn-quiet"
        >
          <Plus className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Add page</span>
        </button>
      )}

      {/* Background Style Selector */}
      {canEdit && activePage && (
        <div className="relative pl-1.5 border-l border-rule">
          <button
            type="button"
            onClick={() => {
              if (onOpenPaperStyleModal) {
                onOpenPaperStyleModal();
              } else {
                setShowBgMenu(!showBgMenu);
              }
            }}
            title="Page Paper Style Dialog (Dotted, Grid, Ruled, Blank)"
            className="btn btn-sm btn-quiet"
          >
            <Grid className="w-3.5 h-3.5" />
            <span className="capitalize">{activePage.background_type || 'Dotted'}</span>
            <ChevronDown className="w-3 h-3" />
          </button>

          {showBgMenu && (
            <div className="menu absolute top-full mt-1.5 right-0 w-44 flex flex-col gap-0.5 z-50">
              {backgrounds.map((bg) => (
                <button
                  key={bg.type}
                  type="button"
                  onClick={() => {
                    onUpdatePage(activePage.id, { background_type: bg.type });
                    setShowBgMenu(false);
                  }}
                  className={`menu-item ${
                    activePage.background_type === bg.type
                      ? 'font-semibold'
                      : ''
                  }`}
                >
                  {bg.icon}
                  <span>{bg.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
