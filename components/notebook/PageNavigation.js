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
  canEdit = true
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
    { type: 'blank', label: 'Blank Canvas', icon: <FileText className="w-3.5 h-3.5" /> },
    { type: 'ruled', label: 'Ruled Lined', icon: <AlignLeft className="w-3.5 h-3.5" /> },
    { type: 'grid', label: 'Math Grid', icon: <Grid className="w-3.5 h-3.5" /> },
    { type: 'dotted', label: 'Dot Matrix', icon: <CircleDot className="w-3.5 h-3.5" /> }
  ];

  return (
    <div className="flex items-center gap-2 bg-white/90 backdrop-blur-md px-3 py-1.5 rounded-2xl border border-slate-200/90 shadow-sm">
      {/* Pages Tabs */}
      <div className="flex items-center gap-1 overflow-x-auto max-w-md no-scrollbar">
        {pages.map((p) => {
          const isActive = p.id === activePageId;
          const isEditing = editingTitleId === p.id;

          return (
            <div
              key={p.id}
              onClick={() => onSelectPage(p.id)}
              className={`group relative flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-medium cursor-pointer transition-all ${
                isActive
                  ? 'bg-indigo-50 text-indigo-700 shadow-xs border border-indigo-200/80'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
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
                  className="bg-white border border-indigo-300 rounded px-1.5 py-0.5 text-xs text-indigo-900 w-24 focus:outline-none"
                />
              ) : (
                <span
                  onDoubleClick={(e) => canEdit && handleStartRename(p, e)}
                  title="Double click to rename"
                  className="truncate max-w-[110px]"
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
                  className="opacity-0 group-hover:opacity-100 hover:text-rose-600 p-0.5 rounded transition-opacity"
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
          className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-700 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-colors border border-dashed border-slate-300"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>New Page</span>
        </button>
      )}

      {/* Background Style Selector */}
      {canEdit && activePage && (
        <div className="relative pl-1.5 border-l border-slate-200">
          <button
            type="button"
            onClick={() => setShowBgMenu(!showBgMenu)}
            title="Page paper style"
            className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg"
          >
            <span className="capitalize">{activePage.background_type || 'Dotted'}</span>
            <ChevronDown className="w-3 h-3 text-slate-400" />
          </button>

          {showBgMenu && (
            <div className="absolute bottom-full mb-2 right-0 bg-white border border-slate-200 rounded-xl p-1.5 shadow-sheet w-36 flex flex-col gap-0.5 z-40 animate-in fade-in zoom-in-95">
              {backgrounds.map((bg) => (
                <button
                  key={bg.type}
                  type="button"
                  onClick={() => {
                    onUpdatePage(activePage.id, { background_type: bg.type });
                    setShowBgMenu(false);
                  }}
                  className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    activePage.background_type === bg.type
                      ? 'bg-indigo-50 text-indigo-700'
                      : 'text-slate-700 hover:bg-slate-50'
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
