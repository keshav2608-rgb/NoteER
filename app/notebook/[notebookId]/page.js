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
  Lock,
  Globe,
  Check,
  Sun,
  Moon,
  Grid,
  FileText,
  AlignLeft,
  CircleDot
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
  const [showBackgroundMenu, setShowBackgroundMenu] = useState(false);
  const headerMenuRef = useRef(null);

  // Close header menus when clicking outside
  useEffect(() => {
    const handleOutside = (e) => {
      if (headerMenuRef.current && !headerMenuRef.current.contains(e.target)) {
        setShowBackgroundMenu(false);
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
      sendOp(op);
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

  const handleClearCanvas = () => {
    if (confirm('Clear all strokes and shapes on this page?')) {
      sendOp({ type: 'stroke:clear' });
      setDocumentState((prev) => ({ ...prev, strokes: [], shapes: [] }));
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
        body: JSON.stringify({ action: 'create' })
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
    try {
      const res = await fetch(`/api/pages/${pageId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
      if (res.ok) {
        const data = await res.json();
        setPages(pages.map((p) => (p.id === pageId ? data.page : p)));
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

  // Export Canvas as PNG
  const handleExportPNG = () => {
    const canvas = document.querySelector('canvas');
    if (!canvas) return;
    const dataUrl = canvas.toDataURL('image/png');
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
      
      {/* Top Header Bar with Visible Scrollbar for Mobile / Small Screens */}
      <header className="absolute top-0 left-0 right-0 z-30 h-14 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800 px-3 sm:px-4 flex items-center justify-between shadow-2xs text-slate-900 dark:text-slate-100 top-header-scroll min-w-0">
        
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
            <h1 className="font-bold text-sm sm:text-base text-slate-900 dark:text-white truncate max-w-[120px] sm:max-w-xs">
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
        <div ref={headerMenuRef} className="flex items-center gap-1 sm:gap-1.5 shrink-0">
          
          {/* Connect Drawing Tablet Button */}
          <button
            type="button"
            onClick={() => setShowPairingModal(true)}
            className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/80 text-indigo-700 dark:text-indigo-300 font-semibold text-xs transition-colors shadow-2xs shrink-0"
            title="Use iPad or tablet as drawing surface for this PC"
          >
            <Tablet className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <span className="whitespace-nowrap">Connect Tablet</span>
          </button>

          {/* Share Button */}
          <button
            type="button"
            onClick={() => setShowShareModal(true)}
            className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold text-xs transition-colors shrink-0"
            title="Share & invite collaborators"
          >
            <Share2 className="w-4 h-4" />
            <span className="whitespace-nowrap">Share</span>
          </button>

          {/* Page Paper Design Dropdown */}
          <div className="relative shrink-0">
            <button
              type="button"
              onClick={() => setShowBackgroundMenu(!showBackgroundMenu)}
              title="Page Paper Style (Dotted, Grid, Ruled, Blank)"
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold text-xs transition-colors"
            >
              <Grid className="w-4 h-4 text-indigo-500" />
              <span className="capitalize whitespace-nowrap">{activePage?.background_type || 'dotted'}</span>
              <Check className="w-3 h-3 opacity-60 hidden sm:inline" />
            </button>

            {showBackgroundMenu && (
              <div className="absolute top-full right-0 mt-2 w-44 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-1.5 z-50 animate-in fade-in zoom-in-95">
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

      {/* Bottom Floating Page Navigation */}
      <div className="fixed top-16 left-3 sm:left-6 z-20 max-w-[calc(100vw-24px)] overflow-x-auto no-scrollbar">
        <PageNavigation
          pages={pages}
          activePageId={activePage?.id}
          onSelectPage={handleSelectPage}
          onCreatePage={handleCreatePage}
          onUpdatePage={handleUpdatePage}
          onDeletePage={handleDeletePage}
          canEdit={canEdit}
        />
      </div>

      {/* Floating Canvas Toolbar */}
      <CanvasToolbar
        onUndo={handleUndo}
        onRedo={handleRedo}
        onClear={handleClearCanvas}
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

    </div>
  );
}
