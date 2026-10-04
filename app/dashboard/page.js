'use client';
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  BookOpen,
  Plus,
  Tablet,
  Laptop,
  Users,
  Lock,
  Globe,
  Clock,
  Trash2,
  ExternalLink,
  LogOut,
  QrCode,
  FileText,
  Search
} from 'lucide-react';
import NotificationCenter from '@/components/notifications/NotificationCenter';

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [notebooks, setNotebooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all'); // 'all' | 'owned' | 'shared'
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newVisibility, setNewVisibility] = useState('private');
  const [creating, setCreating] = useState(false);

  // Tablet pairing state
  const [pairingCode, setPairingCode] = useState('');
  const [pairingLoading, setPairingLoading] = useState(false);
  const [pairingError, setPairingError] = useState('');

  const loadData = async () => {
    try {
      // 1. Get current user
      const meRes = await fetch('/api/auth/me');
      const meData = await meRes.json();
      if (!meData.authenticated) {
        return router.push('/login');
      }
      setUser(meData.user);

      // 2. Get notebooks
      const nbRes = await fetch('/api/notebooks');
      const nbData = await nbRes.json();
      setNotebooks(nbData.notebooks || []);
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateNotebook = async (e) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    setCreating(true);
    try {
      const res = await fetch('/api/notebooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newTitle.trim(),
          description: newDesc.trim(),
          visibility: newVisibility
        })
      });
      if (res.ok) {
        const data = await res.json();
        router.push(`/notebook/${data.notebook.id}`);
      }
    } catch (err) {
      console.error('Failed to create notebook:', err);
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteNotebook = async (id, title, e) => {
    e.stopPropagation();
    if (!confirm(`Are you sure you want to delete "${title}"?`)) return;

    try {
      const res = await fetch(`/api/notebooks/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setNotebooks(notebooks.filter((n) => n.id !== id));
      }
    } catch (err) {
      console.error('Failed to delete notebook:', err);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      router.push('/login');
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  const handleQuickPair = async (e) => {
    e.preventDefault();
    if (!pairingCode.trim()) return;

    setPairingLoading(true);
    setPairingError('');
    try {
      const res = await fetch('/api/pairing/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: pairingCode.trim() })
      });
      const data = await res.json();
      if (res.ok && data.redirectUrl) {
        router.push(data.redirectUrl);
      } else {
        setPairingError(data.error || 'Invalid pairing code');
      }
    } catch (err) {
      setPairingError('Failed to verify code');
    } finally {
      setPairingLoading(false);
    }
  };

  // Filter notebooks
  const filteredNotebooks = notebooks.filter((nb) => {
    const matchesSearch = nb.title.toLowerCase().includes(search.toLowerCase()) ||
      (nb.description && nb.description.toLowerCase().includes(search.toLowerCase()));

    if (!matchesSearch) return false;
    if (filter === 'owned') return nb.owner_id === user?.id;
    if (filter === 'shared') return nb.owner_id !== user?.id;
    return true;
  });

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      {/* Top Navbar */}
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-slate-200/80 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-md shadow-indigo-500/20">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base font-bold tracking-tight text-slate-900 leading-tight">Notebooks</h1>
            <p className="text-[11px] text-slate-400">Collaborative digital canvases</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Notification Center */}
          <NotificationCenter />

          {/* User profile & logout */}
          <div className="flex items-center gap-2 pl-3 border-l border-slate-200">
            {user?.avatar_url ? (
              <img src={user.avatar_url} alt={user.name} className="w-8 h-8 rounded-full object-cover border" />
            ) : (
              <div className="w-8 h-8 rounded-full bg-indigo-600 text-white font-bold text-xs flex items-center justify-center">
                {user?.name?.charAt(0) || 'U'}
              </div>
            )}
            <div className="hidden sm:block text-left">
              <div className="text-xs font-bold text-slate-800 leading-tight">{user?.name}</div>
              <div className="text-[10px] text-slate-400">{user?.email}</div>
            </div>

            <button
              type="button"
              onClick={handleLogout}
              title="Sign Out"
              className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors ml-1"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 md:p-8 flex flex-col gap-6">
        
        {/* Banner with Actions */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-gradient-to-r from-indigo-900 via-indigo-800 to-slate-900 text-white p-6 md:p-8 rounded-3xl shadow-xl relative overflow-hidden">
          <div className="relative z-10">
            <span className="px-2.5 py-1 rounded-full bg-indigo-500/30 text-indigo-200 text-xs font-semibold uppercase tracking-wider">
              Realtime Canvas Workspace
            </span>
            <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight mt-2">
              Welcome back, {user?.name?.split(' ')[0]}
            </h2>
            <p className="text-slate-300 text-xs md:text-sm max-w-lg mt-1 leading-relaxed">
              Create a multi-page notebook, invite collaborators, or connect a tablet to draw live into your desktop screen.
            </p>
          </div>

          <div className="relative z-10 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 px-5 py-3 bg-white hover:bg-slate-50 text-indigo-900 rounded-2xl font-bold text-xs shadow-lg transition-transform active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>Create Notebook</span>
            </button>
          </div>
        </div>

        {/* Search, Filter Tabs & Tablet Code Box */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
          {/* Tabs */}
          <div className="flex items-center gap-1 bg-slate-200/60 p-1 rounded-2xl self-start">
            <button
              type="button"
              onClick={() => setFilter('all')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                filter === 'all' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All ({notebooks.length})
            </button>
            <button
              type="button"
              onClick={() => setFilter('owned')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                filter === 'owned' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              My Notebooks
            </button>
            <button
              type="button"
              onClick={() => setFilter('shared')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                filter === 'shared' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Shared with Me
            </button>
          </div>

          {/* Search bar & Tablet PIN entry */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search notebooks..."
                className="pl-9 pr-3 py-2 bg-white rounded-2xl border border-slate-200 text-xs focus:outline-none focus:border-indigo-500 w-56"
              />
            </div>

            {/* Quick Pair Form */}
            <form onSubmit={handleQuickPair} className="flex items-center gap-1.5">
              <input
                type="text"
                value={pairingCode}
                onChange={(e) => setPairingCode(e.target.value)}
                placeholder="Tablet PIN (e.g. 748-291)"
                maxLength={10}
                className="px-3 py-2 bg-white rounded-2xl border border-slate-200 text-xs font-mono font-bold tracking-wider text-center uppercase focus:outline-none focus:border-indigo-500 w-44"
              />
              <button
                type="submit"
                disabled={pairingLoading || !pairingCode.trim()}
                title="Connect tablet pad"
                className="p-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl transition-colors disabled:opacity-40"
              >
                <Tablet className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>

        {pairingError && (
          <div className="text-xs text-rose-500 font-semibold">{pairingError}</div>
        )}

        {/* Notebook Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredNotebooks.map((nb) => (
            <div
              key={nb.id}
              onClick={() => router.push(`/notebook/${nb.id}`)}
              className="group bg-white rounded-3xl p-5 border border-slate-200/80 shadow-subtle hover:shadow-sheet hover:border-indigo-200 transition-all cursor-pointer flex flex-col justify-between"
            >
              <div>
                {/* Header status */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-1.5">
                    {nb.visibility === 'shared' ? (
                      <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-blue-50 text-blue-700 border border-blue-200/60">
                        <Globe className="w-3 h-3" />
                        <span>Shared</span>
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-700">
                        <Lock className="w-3 h-3" />
                        <span>Private</span>
                      </span>
                    )}

                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-indigo-50 text-indigo-700">
                      {nb.user_role || 'member'}
                    </span>
                  </div>

                  {nb.owner_id === user?.id && (
                    <button
                      type="button"
                      onClick={(e) => handleDeleteNotebook(nb.id, nb.title, e)}
                      title="Delete notebook"
                      className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-rose-600 rounded-lg transition-opacity"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {/* Title & Desc */}
                <h3 className="font-bold text-slate-900 group-hover:text-indigo-600 transition-colors text-base line-clamp-1">
                  {nb.title}
                </h3>
                <p className="text-xs text-slate-500 mt-1 line-clamp-2 leading-relaxed">
                  {nb.description || 'No description provided.'}
                </p>
              </div>

              {/* Footer info */}
              <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1">
                    <FileText className="w-3.5 h-3.5" />
                    <span>{nb.page_count || 1} pages</span>
                  </span>
                  <span className="flex items-center gap-1">
                    <Users className="w-3.5 h-3.5" />
                    <span>{nb.member_count || 1}</span>
                  </span>
                </div>

                <div className="flex items-center gap-1 text-[11px]">
                  <Clock className="w-3 h-3" />
                  <span>{new Date(nb.updated_at).toLocaleDateString()}</span>
                </div>
              </div>
            </div>
          ))}

          {/* New Notebook Placeholder Card */}
          <div
            onClick={() => setShowCreateModal(true)}
            className="border-2 border-dashed border-slate-200 hover:border-indigo-400 bg-slate-50/50 hover:bg-indigo-50/20 rounded-3xl p-8 flex flex-col items-center justify-center gap-2 cursor-pointer transition-all text-center min-h-[180px]"
          >
            <div className="w-10 h-10 rounded-2xl bg-white border border-slate-200 flex items-center justify-center text-slate-600 shadow-2xs">
              <Plus className="w-5 h-5 text-indigo-600" />
            </div>
            <div className="text-xs font-bold text-slate-800">Create New Notebook</div>
            <div className="text-[11px] text-slate-400">Start with infinite canvas and real-time sync</div>
          </div>
        </div>

      </main>

      {/* Create Notebook Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-indigo-600" />
                <h3 className="font-bold text-base text-slate-900">Create New Notebook</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-slate-700 text-sm font-semibold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateNotebook} className="flex flex-col gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Title</label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g. System Design & Sprint Sketch"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:border-indigo-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Description (optional)</label>
                <textarea
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  placeholder="Brief summary of this notebook..."
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:border-indigo-500 resize-none h-16"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Visibility</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setNewVisibility('private')}
                    className={`flex items-center gap-2 p-2.5 rounded-xl border text-xs font-medium transition-all ${
                      newVisibility === 'private'
                        ? 'border-indigo-500 bg-indigo-50 text-indigo-900 font-semibold'
                        : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <Lock className="w-3.5 h-3.5" />
                    <span>Private Only</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setNewVisibility('shared')}
                    className={`flex items-center gap-2 p-2.5 rounded-xl border text-xs font-medium transition-all ${
                      newVisibility === 'shared'
                        ? 'border-indigo-500 bg-indigo-50 text-indigo-900 font-semibold'
                        : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <Globe className="w-3.5 h-3.5" />
                    <span>Shared</span>
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating || !newTitle.trim()}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold transition-colors disabled:opacity-50"
                >
                  {creating ? 'Creating...' : 'Create Notebook'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
