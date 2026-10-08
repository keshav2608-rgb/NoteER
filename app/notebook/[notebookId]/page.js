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
import SyncStatusBadge from '@/components/collaboration/SyncStatusBadge';
import PresenceBar from '@/components/collaboration/PresenceBar';
import PairingModal from '@/components/notebook/PairingModal';
import ShareModal from '@/components/notebook/ShareModal';
import SnapshotModal from '@/components/notebook/SnapshotModal';
import PaperStyleModal from '@/components/notebook/PaperStyleModal';
import { applyTheme, getInitialTheme } from '@/components/theme/ThemeToggle';

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
    return <NotebookLoading />;
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

function NotebookLoading() {
  return (
    <div className="w-full h-[100dvh] flex flex-col items-center justify-center gap-3 bg-desk" role="status">
      <div className="w-7 h-7 border-[3px] border-rule border-t-ballpoint rounded-full animate-spin" />
      <span className="font-hand text-lg text-pencil">Opening notebook…</span>
    </div>
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

  // The store defaults to light; sync it with the persisted theme so the canvas
  // paper matches the UI when this page is opened directly or refreshed.
  useEffect(() => {
    if (getInitialTheme() !== useNotebookStore.getState().darkMode) {
      toggleDarkMode();
    }
  }, [toggleDarkMode]);

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
    return <NotebookLoading />;
  }

  const activeIndex = Math.max(0, pages.findIndex((p) => p.id === activePage?.id));
  const closeMenus = () => {
    setShowManageMenu(false);
    setShowMobilePageMenu(false);
  };

  return (
    <div className="relative w-full h-[100dvh] overflow-hidden flex flex-col bg-desk select-none">

      {/* Top strip: notebook identity, page tabs, and actions */}
      <header
        className="fixed top-0 inset-x-0 z-30 bg-paper/95 backdrop-blur-sm border-b border-rule"
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
        <div
          className="h-14 flex items-center gap-1 sm:gap-2"
          style={{
            paddingLeft: 'max(0.375rem, env(safe-area-inset-left))',
            paddingRight: 'max(0.375rem, env(safe-area-inset-right))'
          }}
        >
          {/* Back + title */}
          <button
            type="button"
            onClick={() => router.push('/dashboard')}
            title="Back to notebooks"
            aria-label="Back to notebooks"
            className="icon-btn"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-1.5 min-w-0 shrink pr-1 sm:pr-3 sm:border-r sm:border-rule sm:h-8">
            <h1 className="font-hand font-bold text-lg sm:text-xl leading-none text-ink truncate max-w-[30vw] sm:max-w-[220px] translate-y-[2px]">
              {notebook?.title}
            </h1>
            <span
              title={notebook?.visibility === 'shared' ? 'Shared notebook' : 'Private notebook'}
              className="text-pencil shrink-0 hidden sm:inline-flex"
            >
              {notebook?.visibility === 'shared' ? <Globe className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
            </span>
          </div>

          {/* Desktop divider tabs */}
          <nav aria-label="Pages" className="hidden md:flex items-end self-stretch min-w-0 flex-1 pl-1">
            <div className="flex items-end gap-0.5 min-w-0 overflow-x-auto no-scrollbar h-full pt-2.5">
              {pages.map((p) => {
                const isActive = p.id === activePageId;
                const isEditing = editingTitleId === p.id;

                return (
                  <div
                    key={p.id}
                    role="button"
                    tabIndex={0}
                    aria-current={isActive ? 'page' : undefined}
                    onClick={() => handleSelectPage(p.id)}
                    onKeyDown={(e) => {
                      if ((e.key === 'Enter' || e.key === ' ') && !isEditing && e.target === e.currentTarget) {
                        e.preventDefault();
                        handleSelectPage(p.id);
                      }
                    }}
                    className={`group relative flex items-center gap-1 h-full px-3 rounded-t-ctl border border-b-0 text-sm cursor-pointer transition-colors shrink-0 ${
                      isActive
                        ? 'bg-paper border-rule text-ink font-semibold'
                        : 'bg-paper-2 border-transparent text-pencil hover:text-ink'
                    }`}
                  >
                    {isEditing ? (
                      <input
                        type="text"
                        value={tempTitle}
                        autoFocus
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => setTempTitle(e.target.value)}
                        onBlur={() => handleFinishRename(p.id)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleFinishRename(p.id);
                          if (e.key === 'Escape') setEditingTitleId(null);
                        }}
                        className="field h-7 w-28 px-1.5 text-sm"
                      />
                    ) : (
                      <span
                        onDoubleClick={(e) => canEdit && handleStartRename(p, e)}
                        title={canEdit ? `${p.title} (double-click to rename)` : p.title}
                        className={`truncate max-w-[90px] lg:max-w-[120px] ${isActive ? 'hl px-1.5' : ''}`}
                      >
                        {p.title}
                      </span>
                    )}

                    {isActive && canEdit && pages.length > 1 && !isEditing && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm(`Delete ${p.title}?`)) handleDeletePage(p.id);
                        }}
                        title="Delete page"
                        aria-label={`Delete ${p.title}`}
                        className="opacity-0 group-hover:opacity-100 focus:opacity-100 text-pencil hover:text-correction p-0.5 rounded transition-opacity"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
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
                title="Add a page"
                aria-label="Add a page"
                className="icon-btn icon-btn-sm self-center ml-1"
              >
                <Plus className="w-4 h-4" />
              </button>
            )}
          </nav>

          {/* Mobile page switcher */}
          <div ref={mobilePageMenuRef} className="relative md:hidden min-w-0">
            <button
              type="button"
              onClick={() => setShowMobilePageMenu(!showMobilePageMenu)}
              aria-expanded={showMobilePageMenu}
              aria-label="Switch page"
              className="flex items-center gap-1 h-10 pl-2.5 pr-1.5 rounded-ctl border border-rule bg-paper-2 text-sm font-semibold text-ink cursor-pointer min-w-0"
            >
              <span className="truncate max-w-[20vw]">{activePage?.title || 'Page'}</span>
              <span className="text-xs font-normal text-pencil shrink-0">{activeIndex + 1}/{pages.length}</span>
              <ChevronDown className="w-4 h-4 text-pencil shrink-0" />
            </button>

            {showMobilePageMenu && (
              <div className="menu absolute top-full right-0 sm:right-auto sm:left-0 mt-2 w-64 max-w-[calc(100vw-1rem)] z-50">
                <div className="max-h-[50vh] overflow-y-auto">
                  {pages.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        handleSelectPage(p.id);
                        setShowMobilePageMenu(false);
                      }}
                      className="menu-item justify-between"
                    >
                      <span className={`truncate ${p.id === activePageId ? 'hl px-1.5 font-semibold' : ''}`}>{p.title}</span>
                      {p.id === activePageId && <Check className="w-4 h-4 text-pencil shrink-0" />}
                    </button>
                  ))}
                </div>
                {canEdit && (
                  <>
                    <div className="my-1 border-t border-rule" />
                    <button
                      type="button"
                      onClick={() => {
                        setShowMobilePageMenu(false);
                        handleCreatePage();
                      }}
                      className="menu-item"
                    >
                      <Plus className="w-4 h-4 text-pencil" />
                      <span>Add a page</span>
                    </button>
                    {pages.length > 1 && (
                      <button
                        type="button"
                        onClick={() => {
                          setShowMobilePageMenu(false);
                          if (activePage && confirm(`Delete ${activePage.title}?`)) handleDeletePage(activePage.id);
                        }}
                        className="menu-item text-correction"
                      >
                        <Trash2 className="w-4 h-4" />
                        <span>Delete this page</span>
                      </button>
                    )}
                  </>
                )}
              </div>
            )}
          </div>

          <div className="flex-1 md:hidden" />

          {/* Status */}
          <div className="flex items-center gap-2 shrink-0 px-1">
            <SyncStatusBadge />
            <div className="hidden xl:flex">
              <PresenceBar currentUser={currentUser} />
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-0.5 sm:gap-1 shrink-0">
            <button
              type="button"
              onClick={() => setShowPairingModal(true)}
              className="btn btn-sm btn-primary hidden md:inline-flex"
              title="Use a tablet as the drawing pad for this screen"
            >
              <Tablet className="w-4 h-4" />
              <span className="hidden lg:inline">Pair tablet</span>
            </button>

            <button
              type="button"
              onClick={() => setShowShareModal(true)}
              className="btn btn-sm btn-outline hidden md:inline-flex"
              title="Share and invite people"
            >
              <Share2 className="w-4 h-4" />
              <span className="hidden lg:inline">Share</span>
            </button>

            <button
              type="button"
              onClick={() => setShowPaperStyleModal(true)}
              title={`Paper style: ${activePage?.background_type || 'dotted'}`}
              aria-label="Paper style"
              className="icon-btn hidden lg:inline-flex"
            >
              <Grid className="w-[18px] h-[18px]" />
            </button>

            <button
              type="button"
              onClick={() => setShowSnapshotModal(true)}
              className="icon-btn hidden lg:inline-flex"
              title="Version history"
              aria-label="Version history"
            >
              <History className="w-[18px] h-[18px]" />
            </button>

            <button
              type="button"
              onClick={handleExportPNG}
              className="icon-btn hidden lg:inline-flex"
              title="Download page as PNG"
              aria-label="Download page as PNG"
            >
              <Download className="w-[18px] h-[18px]" />
            </button>

            <button
              type="button"
              onClick={handleToggleDark}
              className="icon-btn hidden lg:inline-flex"
              title={darkMode ? 'Switch to light theme' : 'Switch to dark theme'}
              aria-label={darkMode ? 'Switch to light theme' : 'Switch to dark theme'}
            >
              {darkMode ? <Sun className="w-[18px] h-[18px]" /> : <Moon className="w-[18px] h-[18px]" />}
            </button>

            {/* Overflow menu: actions hidden at this width, plus notebook management */}
            <div ref={manageMenuRef} className={`relative shrink-0 ${canEdit ? '' : 'lg:hidden'}`}>
              <button
                type="button"
                onClick={() => setShowManageMenu(!showManageMenu)}
                title="More"
                aria-label="More actions"
                aria-expanded={showManageMenu}
                className="icon-btn"
              >
                <MoreVertical className="w-5 h-5" />
              </button>

              {showManageMenu && (
                <div className="menu absolute top-full right-0 mt-2 w-64 max-w-[calc(100vw-1rem)] z-50">
                  <div className="lg:hidden">
                    <button type="button" onClick={() => { closeMenus(); setShowPairingModal(true); }} className="menu-item md:hidden">
                      <Tablet className="w-4 h-4 text-pencil" />
                      <span>Pair tablet</span>
                    </button>
                    <button type="button" onClick={() => { closeMenus(); setShowShareModal(true); }} className="menu-item md:hidden">
                      <Share2 className="w-4 h-4 text-pencil" />
                      <span>Share</span>
                    </button>
                    <button type="button" onClick={() => { closeMenus(); setShowPaperStyleModal(true); }} className="menu-item">
                      <Grid className="w-4 h-4 text-pencil" />
                      <span className="flex-1">Paper style</span>
                      <span className="text-xs text-pencil capitalize">{activePage?.background_type || 'dotted'}</span>
                    </button>
                    <button type="button" onClick={() => { closeMenus(); setShowSnapshotModal(true); }} className="menu-item">
                      <History className="w-4 h-4 text-pencil" />
                      <span>Version history</span>
                    </button>
                    <button type="button" onClick={() => { closeMenus(); handleExportPNG(); }} className="menu-item">
                      <Download className="w-4 h-4 text-pencil" />
                      <span>Download page as PNG</span>
                    </button>
                    <button type="button" onClick={() => { closeMenus(); handleToggleDark(); }} className="menu-item">
                      {darkMode ? <Sun className="w-4 h-4 text-pencil" /> : <Moon className="w-4 h-4 text-pencil" />}
                      <span>{darkMode ? 'Light theme' : 'Dark theme'}</span>
                    </button>
                    {canEdit && <div className="my-1 border-t border-rule" />}
                  </div>

                  {canEdit && (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          closeMenus();
                          handleClearCanvas();
                        }}
                        className="menu-item"
                      >
                        <Eraser className="w-4 h-4 text-pencil" />
                        <span>Clear this page</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          closeMenus();
                          setShowClearNotebookModal(true);
                        }}
                        className="menu-item"
                      >
                        <RotateCcw className="w-4 h-4 text-pencil" />
                        <span>Clear whole notebook…</span>
                      </button>
                      <div className="my-1 border-t border-rule" />
                      <button
                        type="button"
                        onClick={() => {
                          closeMenus();
                          handleDeleteNotebookPermanently();
                        }}
                        className="menu-item text-correction"
                      >
                        <Trash2 className="w-4 h-4" />
                        <span>Delete notebook</span>
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

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

      {/* Clear notebook confirmation */}
      {showClearNotebookModal && (
        <div onClick={() => setShowClearNotebookModal(false)} className="scrim">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="clear-notebook-title"
            onClick={(e) => e.stopPropagation()}
            className="index-card sm:max-w-md"
          >
            <div className="index-card-head">
              <h3 id="clear-notebook-title" className="index-card-title">Clear the whole notebook?</h3>
            </div>
            <div className="index-card-body flex flex-col gap-5" style={{ paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))' }}>
              <p className="text-sm text-pencil leading-relaxed">
                Every drawing, shape, and note on every page will be erased and extra pages removed, leaving one blank Page 1. This can&apos;t be undone.
              </p>
              <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
                <button type="button" onClick={() => setShowClearNotebookModal(false)} className="btn btn-outline">
                  Keep notebook
                </button>
                <button type="button" onClick={handleClearNotebookOverall} className="btn btn-danger">
                  <Trash2 className="w-4 h-4" />
                  <span>Clear everything</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
