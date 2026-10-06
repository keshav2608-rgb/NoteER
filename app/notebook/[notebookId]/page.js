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
  Eraser
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
  const headerMenuRef = useRef(null);
  const manageMenuRef = useRef(null);

  // Close header menus when clicking outside
  useEffect(() => {
    const handleOutside = (e) => {
      if (headerMenuRef.current && !headerMenuRef.current.contains(e.target)) {
        setShowBackgroundMenu(false);
      }
      if (manageMenuRef.current && !manageMenuRef.current.contains(e.target)) {
        setShowManageMenu(false);
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
      
      {/* Top Header Bar: overflow-visible ensures Paper Design and Management dropdowns flow seamlessly over canvas */}
      <header className="absolute top-0 left-0 right-0 z-30 h-14 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800 px-3 sm:px-4 flex items-center justify-between shadow-2xs text-slate-900 dark:text-slate-100 min-w-0 overflow-visible">
        
        {/* Left: Back & Title */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0 mr-2 sm:mr-4">
          <button
            type="button"
            onClick={() => router.push('/dashboard')}
            title="Back to Dashboard"
            className="p-2 rounded-xl text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-2">
            <h1 className="font-bold text-sm sm:text-base text-slate-900 dark:text-white truncate max-w-[100px] xs:max-w-[140px] sm:max-w-xs">
              {notebook?.title}
            </h1>
            {notebook?.visibility === 'shared' ? (
              <span title="Shared notebook">
                <Globe className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              </span>
            ) : (
              <span title="Private notebook">
                <Lock className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
              </span>
            )}
          </div>
        </div>

        {/* Center: Sync Status & Presence */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0 mr-2 sm:mr-4">
          <SyncStatusBadge />
          <div className="hidden md:flex items-center">
            <PresenceBar currentUser={currentUser} />
          </div>
        </div>

        {/* Right: Actions (Pair Tablet, Share, Page Design, History, Export, Dark Theme) */}
        <div ref={headerMenuRef} className="flex items-center gap-1 sm:gap-1.5 shrink-0 overflow-visible">
          
          {/* Connect Drawing Tablet Button */}
          <button
            type="button"
            onClick={() => setShowPairingModal(true)}
            className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/80 text-indigo-700 dark:text-indigo-300 font-semibold text-xs transition-colors shadow-2xs shrink-0"
            title="Use iPad or tablet as drawing surface for this PC"
          >
            <Tablet className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <span className="whitespace-nowrap hidden md:inline">Connect Tablet</span>
          </button>

          {/* Share Button */}
          <button
            type="button"
            onClick={() => setShowShareModal(true)}
            className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold text-xs transition-colors shrink-0"
            title="Share & invite collaborators"
          >
            <Share2 className="w-4 h-4" />
            <span className="whitespace-nowrap hidden sm:inline">Share</span>
          </button>

          {/* Page Paper Design Dropdown & Dialog Trigger */}
          <div className="relative shrink-0">
            <button
              type="button"
              onClick={() => {
                setShowPaperStyleModal(true);
                setShowManageMenu(false);
              }}
              title="Page Paper Style Dialog (Dotted, Grid, Ruled, Blank)"
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold text-xs transition-colors cursor-pointer"
            >
              <Grid className="w-4 h-4 text-indigo-500" />
              <span className="capitalize whitespace-nowrap hidden sm:inline">{activePage?.background_type || 'dotted'}</span>
              <ChevronDown className="w-3 h-3 opacity-60 hidden lg:inline" />
            </button>

            {showBackgroundMenu && (
              <div className="absolute top-full right-0 mt-2 w-48 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-1.5 z-50 animate-in fade-in zoom-in-95 pointer-events-auto">
                <div className="px-2.5 py-1 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  Paper Design
                </div>
                {BACKGROUND_TYPES.map((b) => {
                  const Icon = b.icon;
                  const isSelected = (activePage?.background_type || 'dotted') === b.id;
                  return (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => {
                        handleUpdatePage(activePage.id, { background_type: b.id });
                        setShowBackgroundMenu(false);
                      }}
                      className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-xs font-medium transition-colors ${
                        isSelected
                          ? 'bg-indigo-600 text-white shadow-xs'
                          : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Icon className="w-3.5 h-3.5" />
                        <span>{b.label}</span>
                      </div>
                      {isSelected && <Check className="w-3.5 h-3.5" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Version Snapshots Button */}
          <button
            type="button"
            onClick={() => setShowSnapshotModal(true)}
            className="p-2 rounded-xl text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0"
            title="Version History & Snapshots"
          >
            <History className="w-4 h-4" />
          </button>

          {/* Export PNG */}
          <button
            type="button"
            onClick={handleExportPNG}
            className="p-2 rounded-xl text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0"
            title="Export page as image"
          >
            <Download className="w-4 h-4" />
          </button>

          {/* Dark Mode Toggle */}
          <button
            type="button"
            onClick={handleToggleDark}
            className="p-2 rounded-xl text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0"
            title={darkMode ? 'Switch to Light Canvas' : 'Switch to Dark Canvas'}
          >
            {darkMode ? <Sun className="w-4 h-4 text-amber-500" /> : <Moon className="w-4 h-4 text-slate-600 dark:text-slate-400" />}
          </button>

          {/* Notebook Management Actions Menu (Clear overall, delete permanently) */}
          {canEdit && (
            <div ref={manageMenuRef} className="relative shrink-0">
              <button
                type="button"
                onClick={() => {
                  setShowManageMenu(!showManageMenu);
                  setShowBackgroundMenu(false);
                }}
                title="Notebook Options & Management"
                className="p-2 rounded-xl text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0"
              >
                <MoreVertical className="w-4 h-4" />
              </button>

              {showManageMenu && (
                <div className="absolute top-full right-0 mt-2 w-64 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-2 z-50 animate-in fade-in zoom-in-95 pointer-events-auto">
                  <div className="px-2.5 py-1 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    Notebook Management
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setShowManageMenu(false);
                      handleClearCanvas();
                    }}
                    className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
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
                    className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs font-medium text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40 transition-colors"
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
                    className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
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

      {/* Main Interactive Drawing Canvas */}
      <main className="flex-1 w-full h-full pt-14 relative overflow-hidden">
        <DrawingCanvas
          documentState={documentState}
          onSendOp={sendOp}
          onSendCursor={sendCursor}
          backgroundType={activePage?.background_type || 'dotted'}
          readOnly={!canEdit}
        />
      </main>

      {/* Floating Page Navigation: overflow-visible ensures paper style dropdowns and renaming never clip */}
      <div className="fixed top-16 left-3 sm:left-6 z-20 max-w-[calc(100vw-24px)] overflow-visible">
        <PageNavigation
          pages={pages}
          activePageId={activePage?.id}
          onSelectPage={handleSelectPage}
          onCreatePage={handleCreatePage}
          onUpdatePage={handleUpdatePage}
          onDeletePage={handleDeletePage}
          canEdit={canEdit}
          onOpenPaperStyleModal={() => setShowPaperStyleModal(true)}
        />
      </div>

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
