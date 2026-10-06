'use client';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Tablet,
  Share2,
  History,
  Download,
  Settings,
  MoreHorizontal,
  MoreVertical,
  Lock,
  Globe,
  Check,
  Sun,
  Moon,
  Grid,
  FileText,
  AlignLeft,
  CircleDot,
  RotateCcw,
  Trash2,
  Eraser,
  ChevronDown,
  Plus
} from 'lucide-react';
import { useNotebookStore } from '@/lib/store/useNotebookStore';
import { useCollabSocket } from '@/lib/collaboration/useCollabSocket';
import DrawingCanvas from '@/components/canvas/DrawingCanvas';
import CanvasToolbar from '@/components/canvas/CanvasToolbar';
import PageNavigation from '@/components/notebook/PageNavigation';
import SyncStatusBadge from '@/components/collaboration/SyncStatusBadge';
import PresenceBar from '@/components/collaboration/PresenceBar';
import PairingModal from '@/components/notebook/PairingModal';
import ShareModal from '@/components/notebook/ShareModal';
import SnapshotModal from '@/components/notebook/SnapshotModal';
import PaperStyleModal from '@/components/notebook/PaperStyleModal';
import { applyTheme } from '@/components/theme/ThemeToggle';

export default function NotebookPage({ params }) {
  const { notebookId } = params;
  const router = useRouter();

  const [notebook, setNotebook] = useState(null);
  const [pages, setPages] = useState([]);
  const [members, setMembers] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const { setCanEdit, setActivePageId } = useNotebookStore();

  // Load notebook and pages
  const loadNotebook = useCallback(async () => {
    try {
      const meRes = await fetch('/api/auth/me');
      const meData = await meRes.json();
      if (!meData.authenticated) {
        return router.push('/login');
      }
      setCurrentUser(meData.user);

      const res = await fetch(`/api/notebooks/${notebookId}`);
      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          alert('You do not have permission to view this notebook.');
          return router.push('/dashboard');
        }
        throw new Error('Failed to load notebook');
      }

      const data = await res.json();
      setNotebook(data.notebook);
      const loadedPages = data.pages || [];
      setPages(loadedPages);
      setMembers(data.members || []);

      const userCanEdit = data.userRole === 'owner' || data.userRole === 'editor';
      setCanEdit(userCanEdit);

      if (loadedPages.length > 0) {
        const currentActive = useNotebookStore.getState().activePageId;
        const pageExists = loadedPages.some((p) => p.id === currentActive);
        if (!pageExists) {
          setActivePageId(loadedPages[0].id);
        }
      }
    } catch (err) {
      console.error('Error loading notebook:', err);
    } finally {
      setLoading(false);
    }
  }, [notebookId, router, setCanEdit, setActivePageId]);

  useEffect(() => {
    loadNotebook();
  }, [loadNotebook]);

  if (loading || !notebook || pages.length === 0 || !currentUser) {
    return (
      <div className="w-full h-[100dvh] flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <NotebookEditorSession
      notebookId={notebookId}
      notebook={notebook}
      pages={pages}
      members={members}
      currentUser={currentUser}
      setNotebook={setNotebook}
      setPages={setPages}
      setMembers={setMembers}
      onReloadNotebook={loadNotebook}
    />
  );
}

const BACKGROUND_TYPES = [
  { id: 'dotted', label: 'Dotted Paper', icon: CircleDot },
  { id: 'grid', label: 'Math Grid', icon: Grid },
  { id: 'ruled', label: 'Ruled Lined', icon: AlignLeft },
  { id: 'blank', label: 'Blank Canvas', icon: FileText }
];

function NotebookEditorSession({
  notebookId,
  notebook,
  pages,
  members,
  currentUser,
  setNotebook,
  setPages,
  setMembers,
  onReloadNotebook
}) {
  const router = useRouter();

  // Modals
  const [showPairingModal, setShowPairingModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showSnapshotModal, setShowSnapshotModal] = useState(false);
  const [showPaperStyleModal, setShowPaperStyleModal] = useState(false);
  const [showBackgroundMenu, setShowBackgroundMenu] = useState(false);
  const [showManageMenu, setShowManageMenu] = useState(false);
  const [showMobilePageMenu, setShowMobilePageMenu] = useState(false);
  const [editingTitleId, setEditingTitleId] = useState(null);
  const [tempTitle, setTempTitle] = useState('');
  const headerMenuRef = useRef(null);
  const manageMenuRef = useRef(null);
  const mobilePageMenuRef = useRef(null);

  const handleStartRename = (page, e) => {
    e.stopPropagation();
    setEditingTitleId(page.id);
    setTempTitle(page.title);
  };

  const handleFinishRename = (pageId) => {
    if (tempTitle.trim()) {
      handleUpdatePage(pageId, { title: tempTitle.trim() });
    }
    setEditingTitleId(null);
  };

  // Close header menus when clicking outside
  useEffect(() => {
    const handleOutside = (e) => {
      if (headerMenuRef.current && !headerMenuRef.current.contains(e.target)) {
        setShowBackgroundMenu(false);
      }
      if (manageMenuRef.current && !manageMenuRef.current.contains(e.target)) {
        setShowManageMenu(false);
      }
      if (mobilePageMenuRef.current && !mobilePageMenuRef.current.contains(e.target)) {
        setShowMobilePageMenu(false);
      }
    };
    document.addEventListener('pointerdown', handleOutside);
    return () => document.removeEventListener('pointerdown', handleOutside);
  }, []);

  const {
    activePageId,
    setActivePageId,
    canEdit,
    popUndo,
    popRedo,
    darkMode,
    toggleDarkMode
  } = useNotebookStore();

  const activePage = pages.find((p) => p.id === activePageId) || pages[0];

  // Collaboration socket hook for the current active page
  const {
    documentState,
    setDocumentState,
    sendOp,
    sendCursor
  } = useCollabSocket({
    notebookId,
    pageId: activePage?.id || pages[0]?.id,
    isTablet: false
  });

  // Deactivate pairing sessions when notebook unloads or user leaves
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
        navigator.sendBeacon(`/api/notebooks/${notebookId}/pairing/deactivate`);
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
        navigator.sendBeacon(`/api/notebooks/${notebookId}/pairing/deactivate`);
      } else {
        fetch(`/api/notebooks/${notebookId}/pairing/deactivate`, { method: 'POST', keepalive: true }).catch(() => {});
      }
    };
  }, [notebookId]);

  // Undo / Redo handlers
  const handleUndo = useCallback(() => {
    const op = popUndo();
    if (op) {
      if (op.type === 'text:delete') {
        sendOp({
          type: 'text:delete',
          textBlockId: op.textBlockId || op.textBlock?.id,
          textBlock: { id: op.textBlockId || op.textBlock?.id, deleted: true }
        });
      } else if (op.type === 'text:update') {
        sendOp({ type: 'text:update', textBlock: op.textBlock });
      } else {
        sendOp(op);
      }
    }
  }, [popUndo, sendOp]);

  const handleRedo = useCallback(() => {
    const op = popRedo();
    if (op) {
      if (op.type === 'stroke:erase') {
        const stroke = op.stroke || documentState.strokes?.find((s) => s.id === op.strokeId);
        if (stroke) sendOp({ type: 'stroke:add', stroke });
      } else if (op.type === 'shape:delete') {
        const shape = op.shape || documentState.shapes?.find((s) => s.id === op.shapeId);
        if (shape) sendOp({ type: 'shape:add', shape });
      } else if (op.type === 'stroke:add') {
        if (op.stroke?.id || op.strokeId) {
          sendOp({ type: 'stroke:erase', strokeId: op.stroke?.id || op.strokeId });
        }
      } else if (op.type === 'shape:add') {
        if (op.shape?.id || op.shapeId) {
          sendOp({ type: 'shape:delete', shapeId: op.shape?.id || op.shapeId });
        }
      } else if (op.type === 'text:delete') {
        if (op.textBlock) sendOp({ type: 'text:update', textBlock: op.textBlock });
      } else if (op.type === 'text:update') {
        const bId = op.textBlock?.id || op.textBlockId;
        if (bId) sendOp({ type: 'text:delete', textBlockId: bId, textBlock: { id: bId, deleted: true } });
      } else {
        sendOp(op);
      }
    }
  }, [popRedo, documentState, sendOp]);

  // Keyboard shortcuts (Ctrl+Z, Ctrl+Y, Ctrl+Shift+Z)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        handleRedo();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleUndo, handleRedo]);

  const [showClearNotebookModal, setShowClearNotebookModal] = useState(false);

  const handleClearCanvas = async () => {
    sendOp({ type: 'stroke:clear' });
    setDocumentState({ strokes: [], shapes: [], textBlocks: [] });
    useNotebookStore.setState({ undoStack: [], redoStack: [] });
    if (activePage?.id) {
      try {
        await fetch(`/api/pages/${activePage.id}/clear`, { method: 'POST' });
      } catch (err) {
        console.error('Error clearing page canvas:', err);
      }
    }
  };

  const handleClearNotebookOverall = async () => {
    try {
      const res = await fetch(`/api/notebooks/${notebookId}/clear`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        sendOp({ type: 'stroke:clear' });
        setDocumentState({ strokes: [], shapes: [], textBlocks: [] });
        useNotebookStore.setState({ undoStack: [], redoStack: [] });
        if (data.pages && data.pages.length > 0) {
          setPages(data.pages);
          setActivePageId(data.activePageId || data.pages[0].id);
        }
        setShowClearNotebookModal(false);
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to clear notebook.');
      }
    } catch (err) {
      console.error('Error clearing notebook overall:', err);
      alert('Failed to clear notebook.');
    }
  };

  const handleDeleteNotebookPermanently = async () => {
    if (!confirm(`Are you sure you want to permanently delete "${notebook?.title}" from the database? All pages, drawings, notes, and snapshots will be erased forever.`)) {
      return;
    }
    try {
      const res = await fetch(`/api/notebooks/${notebookId}?permanent=true`, { method: 'DELETE' });
      if (res.ok) {
        router.push('/dashboard');
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to delete notebook.');
      }
    } catch (err) {
      console.error('Error deleting notebook permanently:', err);
      alert('Failed to delete notebook.');
    }
  };

  // Page management handlers
  const handleSelectPage = (pageId) => {
    if (pageId === activePageId) return;
    setDocumentState({ strokes: [], shapes: [], textBlocks: [] });
    setActivePageId(pageId);
  };

  const handleCreatePage = async () => {
    try {
      const res = await fetch(`/api/notebooks/${notebookId}/pages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          background_type: activePage?.background_type || 'dotted'
        })
      });
      if (res.ok) {
        const data = await res.json();
        setDocumentState({ strokes: [], shapes: [], textBlocks: [] });
        setPages([...pages, data.page]);
        setActivePageId(data.page.id);
      }
    } catch (err) {
      console.error('Error creating page:', err);
    }
  };

  const handleUpdatePage = async (pageId, updates) => {
    // Optimistically update pages state immediately for instant UI responsiveness
    setPages((prevPages) => prevPages.map((p) => (p.id === pageId ? { ...p, ...updates } : p)));
    try {
      const res = await fetch(`/api/pages/${pageId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
      if (res.ok) {
        const data = await res.json();
        setPages((prevPages) => prevPages.map((p) => (p.id === pageId ? data.page : p)));
      }
    } catch (err) {
      console.error('Error updating page:', err);
    }
  };

  const handleDeletePage = async (pageId) => {
    try {
      const res = await fetch(`/api/pages/${pageId}`, { method: 'DELETE' });
      if (res.ok) {
        const remaining = pages.filter((p) => p.id !== pageId);
        setPages(remaining);
        if (activePageId === pageId && remaining.length > 0) {
          setActivePageId(remaining[0].id);
        }
      }
    } catch (err) {
      console.error('Error deleting page:', err);
    }
  };

  // Member management handlers
  const handleAddMember = async (email, role) => {
    const res = await fetch(`/api/notebooks/${notebookId}/members`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, role })
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || 'Failed to add member');
    }
    onReloadNotebook();
  };

  const handleRemoveMember = async (userId) => {
    const res = await fetch(`/api/notebooks/${notebookId}/members?userId=${userId}`, {
      method: 'DELETE'
    });
    if (res.ok) {
      setMembers(members.filter((m) => m.user_id !== userId));
    }
  };

  const handleUpdateVisibility = async (visibility) => {
    const res = await fetch(`/api/notebooks/${notebookId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ visibility })
    });
    if (res.ok) {
      const data = await res.json();
      setNotebook(data.notebook);
    }
  };

  // Restore snapshot
  const handleRestoreSnapshot = (snapshot) => {
    try {
      const parsedData = typeof snapshot.snapshot_data === 'string'
        ? JSON.parse(snapshot.snapshot_data)
        : snapshot.snapshot_data;

      sendOp({ type: 'state:restore', documentState: parsedData });
      setDocumentState(parsedData);
    } catch (err) {
      console.error('Failed to parse snapshot data:', err);
    }
  };

  // Export Canvas as PNG (includes strokes, shapes, and text notes)
  const handleExportPNG = () => {
    const mainCanvas = document.querySelector('canvas');
    if (!mainCanvas) return;

    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = mainCanvas.width;
    exportCanvas.height = mainCanvas.height;
    const ctx = exportCanvas.getContext('2d');
    if (!ctx) return;

    // Draw main drawing canvas
    ctx.drawImage(mainCanvas, 0, 0);

    // If there are text blocks, draw them at world-to-screen coords
    if (documentState.textBlocks && documentState.textBlocks.length > 0) {
      const dpr = window.devicePixelRatio || 1;
      const { zoom, panX, panY } = useNotebookStore.getState();

      ctx.save();
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.translate(panX, panY);
      ctx.scale(zoom, zoom);

      for (const block of documentState.textBlocks) {
        if (!block.text || !block.text.trim()) continue;
        const bX = block.x || 0;
        const bY = block.y || 0;
        const bW = block.width || 320;
        const fSize = block.fontSize || 18;
        const isBold = block.fontWeight === 'bold';
        const isItalic = block.fontStyle === 'italic';
        const isCentered = block.textAlign === 'center';

        const styleId = block.style || 'yellow';
        const bgColors = {
          yellow: '#fef08a',
          blue: '#e0f2fe',
          green: '#dcfce7',
          purple: '#f3e8ff',
          pink: '#ffe4e6',
          card: '#ffffff'
        };
        const textColors = {
          yellow: '#451a03',
          blue: '#082f49',
          green: '#064e3b',
          purple: '#3b0764',
          pink: '#4c0519',
          card: '#0f172a'
        };

        const lines = block.text.split('\n');
        const lineHeight = fSize * 1.45;
        const pad = 12;
        const cardH = Math.max(48, lines.length * lineHeight + pad * 2);

        if (bgColors[styleId]) {
          ctx.save();
          ctx.fillStyle = bgColors[styleId];
          ctx.shadowColor = 'rgba(0,0,0,0.08)';
          ctx.shadowBlur = 8;
          ctx.shadowOffsetY = 2;
          ctx.beginPath();
          ctx.roundRect(bX, bY, bW, cardH, 16);
          ctx.fill();
          ctx.restore();
        }

        ctx.font = `${isItalic ? 'italic ' : ''}${isBold ? 'bold ' : ''}${fSize}px sans-serif`;
        ctx.fillStyle = textColors[styleId] || block.color || '#0f172a';
        ctx.textAlign = isCentered ? 'center' : 'left';
        ctx.textBaseline = 'top';

        lines.forEach((line, idx) => {
          const textX = isCentered ? bX + bW / 2 : bX + pad;
          const textY = bY + pad + idx * lineHeight;
          ctx.fillText(line, textX, textY);
        });
      }
      ctx.restore();
    }

    const dataUrl = exportCanvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = `${notebook?.title || 'notebook'}-${activePage?.title || 'page'}.png`;
    link.href = dataUrl;
    link.click();
  };

  const handleToggleDark = () => {
    const next = !darkMode;
    toggleDarkMode();
    applyTheme(next);
  };

  if (!currentUser) {
    return (
      <div className="w-full h-[100dvh] flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-[100dvh] overflow-hidden flex flex-col bg-slate-100 dark:bg-slate-950 select-none">
      
      {/* Unified Floating Studio Command Island */}
      <div className="fixed top-3 sm:top-4 inset-x-3 sm:inset-x-6 z-30 pointer-events-none flex justify-center">
        <div className="pointer-events-auto w-full max-w-7xl p-1.5 rounded-2xl sm:rounded-full bg-slate-900/5 dark:bg-white/[0.04] border border-slate-200/80 dark:border-white/[0.08] shadow-[0_16px_36px_-8px_rgba(0,0,0,0.14),0_4px_12px_-2px_rgba(0,0,0,0.06)] backdrop-blur-2xl ring-1 ring-black/5 dark:ring-white/5">
          <header className="px-3 sm:px-4 py-1.5 sm:py-2 rounded-[calc(1rem-2px)] sm:rounded-full bg-white/95 dark:bg-[#0c0e15]/95 backdrop-blur-xl border border-slate-200/70 dark:border-white/[0.06] flex items-center justify-between gap-2 sm:gap-4 shadow-[inset_0_1px_1px_rgba(255,255,255,0.4)] dark:shadow-[inset_0_1px_1px_rgba(255,255,255,0.08)] select-none">
            
            {/* Left Zone: Dashboard Return & Notebook Title */}
            <div className="flex items-center gap-2 sm:gap-3 shrink-0">
              <button
                type="button"
                onClick={() => router.push('/dashboard')}
                title="Back to Dashboard"
                className="p-1.5 sm:p-2 rounded-full text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-all hover:scale-105 active:scale-95 cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>

              <div className="flex items-center gap-2 min-w-0">
                <h1 className="font-bold text-sm sm:text-base text-slate-900 dark:text-white truncate max-w-[100px] xs:max-w-[140px] sm:max-w-[200px] tracking-tight">
                  {notebook?.title}
                </h1>
                {notebook?.visibility === 'shared' ? (
                  <span title="Shared notebook" className="p-1 rounded-md bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-200/60 dark:border-blue-800/60 shrink-0">
                    <Globe className="w-3 h-3" />
                  </span>
                ) : (
                  <span title="Private notebook" className="p-1 rounded-md bg-slate-100 dark:bg-slate-800/60 text-slate-400 dark:text-slate-500 border border-slate-200/60 dark:border-slate-700/60 shrink-0">
                    <Lock className="w-3 h-3" />
                  </span>
                )}
              </div>
            </div>

            {/* Center Zone: Natively Integrated Page Switcher Tabs */}
            <div className="flex items-center gap-2 shrink-0">
              {/* Desktop Page Switcher Pills */}
              <div className="hidden md:flex items-center gap-1 px-1.5 py-1 rounded-full bg-slate-100/80 dark:bg-[#12141e] border border-slate-200/70 dark:border-white/[0.06]">
                <div className="flex items-center gap-1 max-w-[180px] lg:max-w-xs xl:max-w-md overflow-x-auto no-scrollbar">
                  {pages.map((p) => {
                    const isActive = p.id === activePageId;
                    const isEditing = editingTitleId === p.id;

                    return (
                      <div
                        key={p.id}
                        onClick={() => handleSelectPage(p.id)}
                        className={`group relative flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold cursor-pointer transition-all ${
                          isActive
                            ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm border border-slate-200/80 dark:border-slate-700'
                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/60 dark:hover:bg-slate-800/60'
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
                            className="bg-white dark:bg-slate-800 border border-indigo-400 rounded-md px-1.5 py-0.5 text-xs text-indigo-900 dark:text-white w-20 focus:outline-none"
                          />
                        ) : (
                          <span
                            onDoubleClick={(e) => canEdit && handleStartRename(p, e)}
                            title="Double-click to rename page"
                            className="truncate max-w-[85px] lg:max-w-[110px]"
                          >
                            {p.title}
                          </span>
                        )}

                        {isActive && canEdit && pages.length > 1 && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (confirm(`Delete ${p.title}?`)) handleDeletePage(p.id);
                            }}
                            title="Delete page"
                            className="opacity-0 group-hover:opacity-100 hover:text-rose-600 dark:hover:text-rose-400 p-0.5 rounded transition-opacity cursor-pointer"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>

                {canEdit && (
                  <button
                    type="button"
                    onClick={handleCreatePage}
                    title="Add New Page"
                    className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50/70 dark:hover:bg-indigo-950/60 rounded-full transition-all border border-dashed border-slate-300 dark:border-slate-700 shrink-0 cursor-pointer active:scale-95"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span className="hidden lg:inline text-[11px]">Page</span>
                  </button>
                )}
              </div>

              {/* Mobile Compact Page Switcher Dropdown */}
              <div ref={mobilePageMenuRef} className="relative flex md:hidden items-center gap-1">
                <button
                  type="button"
                  onClick={() => setShowMobilePageMenu(!showMobilePageMenu)}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800/80 text-xs font-semibold text-slate-700 dark:text-slate-300 border border-slate-200/80 dark:border-slate-700 cursor-pointer"
                >
                  <span className="truncate max-w-[70px]">{activePage?.title || 'Page'}</span>
                  <span className="text-[10px] text-slate-400">({pages.findIndex((p) => p.id === activePage?.id) + 1}/{pages.length})</span>
                  <ChevronDown className="w-3 h-3 text-slate-400" />
                </button>

                {canEdit && (
                  <button
                    type="button"
                    onClick={handleCreatePage}
                    title="Add New Page"
                    className="p-1 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200/60 dark:border-indigo-800/60 cursor-pointer active:scale-95"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                )}

                {showMobilePageMenu && (
                  <div className="absolute top-full left-0 mt-2 w-48 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-1.5 z-50 animate-in fade-in zoom-in-95 pointer-events-auto">
                    <div className="px-2.5 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      Switch Page
                    </div>
                    {pages.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => {
                          handleSelectPage(p.id);
                          setShowMobilePageMenu(false);
                        }}
                        className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                          p.id === activePageId
                            ? 'bg-indigo-600 text-white shadow-xs'
                            : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                        }`}
                      >
                        <span className="truncate">{p.title}</span>
                        {p.id === activePageId && <Check className="w-3.5 h-3.5" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Sync Status Badge & Live Presence */}
              <div className="hidden sm:flex items-center gap-2">
                <SyncStatusBadge />
                <div className="hidden xl:flex items-center">
                  <PresenceBar currentUser={currentUser} />
                </div>
              </div>
            </div>

            {/* Right Zone: Studio CTAs, Actions & Modals */}
            <div ref={headerMenuRef} className="flex items-center gap-1 sm:gap-1.5 shrink-0">
              
              {/* Button-in-button Tablet Pairing CTA */}
              <button
                type="button"
                onClick={() => setShowPairingModal(true)}
                className="group flex items-center gap-1.5 pl-2.5 sm:pl-3 pr-1 sm:pr-1.5 py-1 sm:py-1.5 rounded-full bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-600 text-white font-bold text-xs shadow-sm shadow-indigo-500/25 active:scale-95 transition-all shrink-0 cursor-pointer"
                title="Pair iPad or tablet as drawing surface for this PC"
              >
                <span className="whitespace-nowrap hidden sm:inline text-[11px] font-semibold tracking-wide">Pair Tablet</span>
                <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-white/20 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                  <Tablet className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-white" />
                </div>
              </button>

              {/* Page Paper Style Trigger Button */}
              <button
                type="button"
                onClick={() => setShowPaperStyleModal(true)}
                title="Page Paper Style Dialog (Dotted, Grid, Ruled, Blank)"
                className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-full bg-slate-100/90 dark:bg-slate-800/90 hover:bg-slate-200/80 dark:hover:bg-slate-700/80 text-slate-700 dark:text-slate-300 font-semibold text-xs border border-slate-200/60 dark:border-white/[0.06] transition-all cursor-pointer active:scale-95 shrink-0"
              >
                <Grid className="w-3.5 h-3.5 text-indigo-500" />
                <span className="capitalize whitespace-nowrap hidden md:inline text-[11px]">{activePage?.background_type || 'dotted'}</span>
              </button>

              {/* Share Notebook Modal Button */}
              <button
                type="button"
                onClick={() => setShowShareModal(true)}
                className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-full bg-slate-100/90 dark:bg-slate-800/90 hover:bg-slate-200/80 dark:hover:bg-slate-700/80 text-slate-700 dark:text-slate-300 font-semibold text-xs border border-slate-200/60 dark:border-white/[0.06] transition-all cursor-pointer active:scale-95 shrink-0"
                title="Share & invite collaborators"
              >
                <Share2 className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                <span className="whitespace-nowrap hidden lg:inline text-[11px]">Share</span>
              </button>

              {/* Version History / Snapshots Modal */}
              <button
                type="button"
                onClick={() => setShowSnapshotModal(true)}
                className="p-1.5 sm:p-2 rounded-full text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0 cursor-pointer"
                title="Version History & Snapshots"
              >
                <History className="w-4 h-4" />
              </button>

              {/* Export Canvas as PNG */}
              <button
                type="button"
                onClick={handleExportPNG}
                className="p-1.5 sm:p-2 rounded-full text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0 cursor-pointer"
                title="Export page as image"
              >
                <Download className="w-4 h-4" />
              </button>

              {/* Dark / Light Canvas Theme Toggle */}
              <button
                type="button"
                onClick={handleToggleDark}
                className="p-1.5 sm:p-2 rounded-full text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0 cursor-pointer"
                title={darkMode ? 'Switch to Light Canvas' : 'Switch to Dark Canvas'}
              >
                {darkMode ? <Sun className="w-4 h-4 text-amber-500" /> : <Moon className="w-4 h-4 text-slate-600 dark:text-slate-400" />}
              </button>

              {/* Notebook Management Actions Menu */}
              {canEdit && (
                <div ref={manageMenuRef} className="relative shrink-0">
                  <button
                    type="button"
                    onClick={() => setShowManageMenu(!showManageMenu)}
                    title="Notebook Options & Management"
                    className="p-1.5 sm:p-2 rounded-full text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0 cursor-pointer"
                  >
                    <MoreVertical className="w-4 h-4" />
                  </button>

                  {showManageMenu && (
                    <div className="absolute top-full right-0 mt-2 w-64 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-2 z-50 animate-in fade-in zoom-in-95 pointer-events-auto">
                      <div className="px-2.5 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        Notebook Management
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setShowManageMenu(false);
                          handleClearCanvas();
                        }}
                        className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                      >
                        <Eraser className="w-3.5 h-3.5 text-amber-500" />
                        <span>Clear Current Page Canvas</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setShowManageMenu(false);
                          setShowClearNotebookModal(true);
                        }}
                        className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs font-semibold text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40 transition-colors cursor-pointer"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Clear Notebook Overall</span>
                      </button>

                      <div className="my-1 border-t border-slate-100 dark:border-slate-800" />

                      <button
                        type="button"
                        onClick={() => {
                          setShowManageMenu(false);
                          handleDeleteNotebookPermanently();
                        }}
                        className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Delete Notebook Permanently</span>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

          </header>
        </div>
      </div>

      {/* Full-Bleed Edge-to-Edge Drawing Canvas */}
      <main className="absolute inset-0 w-full h-full overflow-hidden">
        <DrawingCanvas
          documentState={documentState}
          onSendOp={sendOp}
          onSendCursor={sendCursor}
          backgroundType={activePage?.background_type || 'dotted'}
          readOnly={!canEdit}
        />
      </main>

      {/* Floating Canvas Toolbar */}
      <CanvasToolbar
        onUndo={handleUndo}
        onRedo={handleRedo}
        onClear={handleClearCanvas}
        onClearNotebook={() => setShowClearNotebookModal(true)}
        backgroundType={activePage?.background_type || 'dotted'}
        onUpdateBackground={(type) => handleUpdatePage(activePage.id, { background_type: type })}
        onOpenPaperStyleModal={() => setShowPaperStyleModal(true)}
      />

      {/* Page Paper Style Dialog Box Modal */}
      <PaperStyleModal
        isOpen={showPaperStyleModal}
        onClose={() => setShowPaperStyleModal(false)}
        currentType={activePage?.background_type || 'dotted'}
        pagesCount={pages.length}
        darkMode={darkMode}
        onSelectType={async (type, applyToAll) => {
          if (applyToAll) {
            for (const p of pages) {
              await handleUpdatePage(p.id, { background_type: type });
            }
          } else {
            await handleUpdatePage(activePage.id, { background_type: type });
          }
        }}
      />

      {/* Tablet-to-PC Pairing Modal */}
      <PairingModal
        notebookId={notebookId}
        isOpen={showPairingModal}
        onClose={() => setShowPairingModal(false)}
      />

      {/* Share & Roles Modal */}
      <ShareModal
        notebook={notebook}
        members={members}
        currentUser={currentUser}
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
        onAddMember={handleAddMember}
        onRemoveMember={handleRemoveMember}
        onUpdateVisibility={handleUpdateVisibility}
      />

      {/* Snapshot / Version History Modal */}
      <SnapshotModal
        notebookId={notebookId}
        pageId={activePage?.id}
        currentDocumentState={documentState}
        isOpen={showSnapshotModal}
        onClose={() => setShowSnapshotModal(false)}
        onRestoreSnapshot={handleRestoreSnapshot}
      />

      {/* Clear Notebook Overall In-App Confirmation Modal */}
      {showClearNotebookModal && (
        <div
          onClick={() => setShowClearNotebookModal(false)}
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/60 backdrop-blur-md animate-in fade-in select-none"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white/98 dark:bg-slate-900/98 border border-slate-200/90 dark:border-slate-800 rounded-[2rem] p-6 shadow-2xl ring-1 ring-black/5 dark:ring-white/10 max-w-md w-full flex flex-col gap-4 text-slate-900 dark:text-slate-100 animate-in zoom-in-95 duration-200"
          >
            <div className="flex items-center gap-3 text-rose-600 dark:text-rose-400">
              <div className="p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900/40">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold">Clear Entire Notebook?</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">This action cannot be undone</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              All drawings, shapes, text notes, and additional pages across the entire notebook will be permanently wiped, resetting it to a single clean Page 1.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowClearNotebookModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleClearNotebookOverall}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white shadow-md transition-colors flex items-center gap-1.5"
              >
                <Trash2 className="w-4 h-4" />
                <span>Yes, Clear Everything</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
