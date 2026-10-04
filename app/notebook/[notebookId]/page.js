'use client';
import React, { useState, useEffect, useCallback } from 'react';
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
  Moon
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

  // Undo / Redo handlers
  const handleUndo = () => {
    const op = popUndo();
    if (op) {
      sendOp(op);
    }
  };

  const handleRedo = () => {
    const op = popRedo();
    if (op) {
      if (op.type === 'stroke:erase') {
        const stroke = documentState.strokes?.find((s) => s.id === op.strokeId);
        if (stroke) sendOp({ type: 'stroke:add', stroke });
      } else if (op.type === 'shape:delete') {
        const shape = documentState.shapes?.find((s) => s.id === op.shapeId);
        if (shape) sendOp({ type: 'shape:add', shape });
      }
    }
  };

  const handleClearCanvas = () => {
    if (confirm('Clear all strokes and shapes on this page?')) {
      sendOp({ type: 'stroke:clear' });
      setDocumentState((prev) => ({ ...prev, strokes: [], shapes: [] }));
    }
  };

  // Page management handlers
  const handleCreatePage = async () => {
    try {
      const res = await fetch(`/api/notebooks/${notebookId}/pages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create' })
      });
      if (res.ok) {
        const data = await res.json();
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
      
      {/* Top Header Bar */}
      <header className="absolute top-0 left-0 right-0 z-30 h-14 bg-white/85 dark:bg-slate-900/85 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800 px-3 sm:px-4 flex items-center justify-between shadow-2xs text-slate-900 dark:text-slate-100">
        
        {/* Left: Back & Title */}
        <div className="flex items-center gap-2 sm:gap-3">
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
        <div className="hidden md:flex items-center gap-3">
          <SyncStatusBadge />
          <PresenceBar currentUser={currentUser} />
        </div>

        {/* Right: Actions (Pair Tablet, Share, History, Export, Dark Theme) */}
        <div className="flex items-center gap-1 sm:gap-1.5">
          {/* Connect Drawing Tablet Button */}
          <button
            type="button"
            onClick={() => setShowPairingModal(true)}
            className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/80 text-indigo-700 dark:text-indigo-300 font-semibold text-xs transition-colors shadow-2xs"
            title="Use iPad or tablet as drawing surface for this PC"
          >
            <Tablet className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <span className="hidden sm:inline">Connect Tablet</span>
          </button>

          {/* Share Button */}
          <button
            type="button"
            onClick={() => setShowShareModal(true)}
            className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold text-xs transition-colors"
            title="Share & invite collaborators"
          >
            <Share2 className="w-4 h-4" />
            <span className="hidden sm:inline">Share</span>
          </button>

          {/* Version Snapshots Button */}
          <button
            type="button"
            onClick={() => setShowSnapshotModal(true)}
            className="p-2 rounded-xl text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title="Version History & Snapshots"
          >
            <History className="w-4 h-4" />
          </button>

          {/* Export PNG */}
          <button
            type="button"
            onClick={handleExportPNG}
            className="p-2 rounded-xl text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title="Export page as image"
          >
            <Download className="w-4 h-4" />
          </button>

          {/* Dark Mode Toggle */}
          <button
            type="button"
            onClick={handleToggleDark}
            className="p-2 rounded-xl text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
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
          onSelectPage={setActivePageId}
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
