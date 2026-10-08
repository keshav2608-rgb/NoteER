'use client';
import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Plus,
  Tablet,
  Users,
  Lock,
  Globe,
  Trash2,
  LogOut,
  FileText,
  Search,
  X
} from 'lucide-react';
import NotificationCenter from '@/components/notifications/NotificationCenter';
import ThemeToggle from '@/components/theme/ThemeToggle';

// Book-cloth colours for notebook covers. Each notebook keeps the same
// colour forever, picked from a hash of its id.
const COVER_CLOTHS = [
  '#2340C8', // ballpoint blue
  '#2F6B4F', // bottle green
  '#A3303A', // crimson
  '#D7A52B', // mustard
  '#3B3768', // ink violet
  '#22303F', // navy
  '#5F8297', // slate blue
  '#7E4F79'  // plum
];

function coverFor(id = '') {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  }
  return COVER_CLOTHS[hash % COVER_CLOTHS.length];
}

function timeAgo(dateValue) {
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return '';
  const seconds = Math.round((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return 'Edited just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `Edited ${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `Edited ${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `Edited ${days}d ago`;
  return `Edited ${date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;
}

function greeting() {
  const hour = new Date().getHours();
  if (hour < 5) return 'Up late';
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'owned', label: 'Mine' },
  { id: 'shared', label: 'Shared with me' }
];

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
  const [createError, setCreateError] = useState('');

  // Tablet pairing state
  const [showPairMenu, setShowPairMenu] = useState(false);
  const [pairingCode, setPairingCode] = useState('');
  const [pairingLoading, setPairingLoading] = useState(false);
  const [pairingError, setPairingError] = useState('');
  const pairMenuRef = useRef(null);

  const loadData = async () => {
    try {
      // 1. Get current user
      const meRes = await fetch('/api/auth/me');
      const meData = await meRes.json();
      if (!meData.authenticated || !meData.user) {
        router.replace('/login');
        return;
      }
      setUser(meData.user);

      // 2. Get notebooks
      const nbRes = await fetch('/api/notebooks');
      if (!nbRes.ok) {
        if (nbRes.status === 401) {
          router.replace('/login');
          return;
        }
      }
      const nbData = await nbRes.json().catch(() => ({}));
      setNotebooks(nbData.notebooks || []);
      setLoading(false);
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
      router.replace('/login');
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Escape closes the create modal and the pairing menu
  useEffect(() => {
    if (!showCreateModal && !showPairMenu) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setShowCreateModal(false);
        setShowPairMenu(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showCreateModal, showPairMenu]);

  // Click outside closes the pairing menu
  useEffect(() => {
    if (!showPairMenu) return;
    const handlePointer = (e) => {
      if (pairMenuRef.current && !pairMenuRef.current.contains(e.target)) {
        setShowPairMenu(false);
      }
    };
    document.addEventListener('pointerdown', handlePointer);
    return () => document.removeEventListener('pointerdown', handlePointer);
  }, [showPairMenu]);

  const openCreateModal = () => {
    setCreateError('');
    setShowCreateModal(true);
  };

  const handleCreateNotebook = async (e) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    setCreating(true);
    setCreateError('');
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
      } else {
        const data = await res.json().catch(() => ({}));
        setCreateError(data.error || 'The notebook could not be created. Try again.');
      }
    } catch (err) {
      console.error('Failed to create notebook:', err);
      setCreateError('Could not reach the server. Check your connection and try again.');
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteNotebook = async (id, title, e) => {
    e.stopPropagation();
    if (!confirm(`Delete "${title}" permanently? Its pages, drawings, notes, snapshots and collaborators are removed for everyone.`)) return;

    try {
      const res = await fetch(`/api/notebooks/${id}?permanent=true`, { method: 'DELETE' });
      if (res.ok) {
        setNotebooks((prev) => prev.filter((n) => n.id !== id));
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data.error || 'Failed to delete notebook');
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
        setPairingError(data.error || 'That code did not match. Check the code on your computer and try again.');
      }
    } catch (err) {
      setPairingError('Could not reach the server. Check your connection and try again.');
    } finally {
      setPairingLoading(false);
    }
  };

  const ownedCount = notebooks.filter((nb) => nb.owner_id === user?.id).length;
  const counts = {
    all: notebooks.length,
    owned: ownedCount,
    shared: notebooks.length - ownedCount
  };

  // Filter notebooks
  const query = search.trim().toLowerCase();
  const filteredNotebooks = notebooks.filter((nb) => {
    const matchesSearch = !query ||
      (nb.title || '').toLowerCase().includes(query) ||
      (nb.description && nb.description.toLowerCase().includes(query));

    if (!matchesSearch) return false;
    if (filter === 'owned') return nb.owner_id === user?.id;
    if (filter === 'shared') return nb.owner_id !== user?.id;
    return true;
  });

  if (loading || !user) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-desk" role="status" aria-label="Loading">
        <div className="w-7 h-7 border-[3px] border-rule border-t-ballpoint rounded-full animate-spin" />
      </div>
    );
  }

  const firstName = user?.name?.split(' ')[0] || 'there';

  return (
    <div className="min-h-[100dvh] bg-desk text-ink flex flex-col">
      {/* Top bar */}
      <header
        className="sticky top-0 z-30 bg-desk/90 backdrop-blur-sm border-b border-rule"
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
        <div className="max-w-6xl mx-auto h-16 px-4 sm:px-6 flex items-center justify-between gap-3">
          <a href="/dashboard" className="font-hand font-bold text-[1.7rem] leading-none text-ink -rotate-1 select-none">
            notebook
          </a>

          <div className="flex items-center gap-1 sm:gap-1.5">
            {/* Pair a tablet */}
            <div className="relative" ref={pairMenuRef}>
              <button
                type="button"
                onClick={() => setShowPairMenu((v) => !v)}
                aria-expanded={showPairMenu}
                className="btn btn-sm btn-quiet h-10 px-2.5 sm:px-3"
                title="Use this device as a drawing pad"
              >
                <Tablet className="w-[18px] h-[18px]" />
                <span className="hidden sm:inline">Pair this tablet</span>
              </button>

              {showPairMenu && (
                <div className="menu fixed sm:absolute left-4 right-4 sm:left-auto sm:right-0 top-[calc(4rem+env(safe-area-inset-top))] sm:top-12 sm:w-80 p-4 z-40">
                  <form onSubmit={handleQuickPair}>
                    <label htmlFor="pair-code" className="label">Pairing code</label>
                    <p className="text-[13px] text-pencil leading-relaxed mb-3">
                      Open a notebook on your computer, choose Pair tablet, and type the code it shows.
                    </p>
                    <div className="flex gap-2">
                      <input
                        id="pair-code"
                        type="text"
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        autoFocus
                        value={pairingCode}
                        onChange={(e) => setPairingCode(e.target.value)}
                        placeholder="748-291"
                        maxLength={10}
                        className="field text-center text-base font-semibold tabular-nums tracking-[0.15em]"
                      />
                      <button
                        type="submit"
                        disabled={pairingLoading || !pairingCode.trim()}
                        className="btn btn-primary shrink-0"
                      >
                        {pairingLoading ? 'Pairing…' : 'Pair'}
                      </button>
                    </div>
                    {pairingError && (
                      <p className="text-[13px] text-correction mt-2" role="alert">{pairingError}</p>
                    )}
                  </form>
                </div>
              )}
            </div>

            <ThemeToggle />
            <NotificationCenter />

            <div className="flex items-center gap-2 pl-2 sm:pl-3 ml-1 border-l border-rule">
              {user?.avatar_url ? (
                <img src={user.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover ring-1 ring-rule" />
              ) : (
                <div className="w-8 h-8 rounded-full bg-ink text-paper font-bold text-sm flex items-center justify-center">
                  {user?.name?.charAt(0) || 'U'}
                </div>
              )}
              <div className="hidden md:block leading-tight max-w-[160px]">
                <div className="text-sm font-semibold truncate">{user?.name}</div>
                <div className="text-xs text-pencil truncate">{user?.email}</div>
              </div>
              <button
                type="button"
                onClick={handleLogout}
                title="Sign out"
                aria-label="Sign out"
                className="icon-btn"
              >
                <LogOut className="w-[18px] h-[18px]" />
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 pt-8 sm:pt-12 pb-16">
        {/* Heading row */}
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-pencil text-[15px]">
              {greeting()}, {firstName}.
            </p>
            <h1 className="text-[2rem] sm:text-[2.6rem] font-bold tracking-tight leading-[1.05] mt-1">
              Your shelf
            </h1>
          </div>
          <button type="button" onClick={openCreateModal} className="btn btn-primary">
            <Plus className="w-4 h-4" />
            New notebook
          </button>
        </div>

        {/* Filters + search */}
        <div className="mt-7 flex flex-col-reverse sm:flex-row sm:items-center justify-between gap-3 border-b border-rule pb-4">
          <div className="flex items-center gap-1 -ml-1 overflow-x-auto scroll-x" role="tablist" aria-label="Filter notebooks">
            {FILTERS.map((f) => {
              const active = filter === f.id;
              return (
                <button
                  key={f.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setFilter(f.id)}
                  className={`shrink-0 h-9 px-3 text-sm font-semibold transition-colors ${
                    active ? 'hl' : 'rounded-ctl text-pencil hover:text-ink hover:bg-paper-2'
                  }`}
                >
                  {f.label}
                  <span className={`ml-1.5 tabular-nums font-medium ${active ? 'opacity-70' : 'opacity-60'}`}>
                    {counts[f.id]}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="relative sm:w-64">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-pencil pointer-events-none" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Find a notebook"
              aria-label="Find a notebook"
              className="field pl-9"
            />
          </div>
        </div>

        {/* Shelf of covers */}
        {filteredNotebooks.length === 0 && (query || filter !== 'all') ? (
          <div className="py-20 text-center">
            <p className="font-hand text-2xl text-pencil">
              {query ? `Nothing matches “${search.trim()}”.` : 'Nothing here yet.'}
            </p>
            <p className="text-sm text-pencil mt-2">
              {filter === 'shared'
                ? 'Notebooks other people share with you will show up here.'
                : 'Try a different word, or start a new notebook.'}
            </p>
          </div>
        ) : (
          <ul className="mt-8 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-x-5 gap-y-9 sm:gap-x-7 sm:gap-y-11">
            {filteredNotebooks.map((nb) => {
              const isOwner = nb.owner_id === user?.id;
              const pageCount = nb.page_count || 1;
              const memberCount = nb.member_count || 1;
              return (
                <li key={nb.id} className="group relative">
                  <button
                    type="button"
                    onClick={() => router.push(`/notebook/${nb.id}`)}
                    className="block w-full text-left rounded-book focus-visible:outline-offset-4"
                    aria-label={`Open ${nb.title}`}
                  >
                    {/* Cover */}
                    <div
                      className="relative aspect-[3/4] rounded-book rounded-l-[2px] shadow-book overflow-hidden transition-transform duration-200 ease-out group-hover:-translate-y-1"
                      style={{ backgroundColor: coverFor(nb.id) }}
                    >
                      {/* cloth grain */}
                      <div
                        className="absolute inset-0 opacity-[0.09] mix-blend-overlay"
                        style={{
                          backgroundImage:
                            'repeating-linear-gradient(45deg, #fff 0 1px, transparent 1px 3px), repeating-linear-gradient(-45deg, #000 0 1px, transparent 1px 3px)'
                        }}
                      />
                      {/* spine */}
                      <div className="absolute inset-y-0 left-0 w-[9%] bg-black/25 border-r border-white/10" />
                      {/* elastic band */}
                      <div className="absolute inset-y-0 right-[13%] w-[5px] bg-black/35 shadow-[1px_0_0_rgba(255,255,255,0.12)]" />
                      {/* label */}
                      <div className="absolute left-[19%] right-[24%] top-[16%] bg-[#FBFAF5] rounded-[2px] px-2.5 pt-2 pb-2.5 shadow-[0_1px_2px_rgba(0,0,0,0.25)]">
                        <div className="h-px bg-[#C42E38]/40 mb-1.5" />
                        <p className="font-hand text-[#24272b] text-[15px] sm:text-base leading-[1.15] line-clamp-3 break-words">
                          {nb.title}
                        </p>
                      </div>
                      {/* shared sticker */}
                      {nb.visibility === 'shared' && (
                        <div className="absolute left-[19%] bottom-[9%] flex items-center gap-1 text-[11px] font-semibold text-white/85">
                          <Globe className="w-3 h-3" />
                          Shared
                        </div>
                      )}
                    </div>

                  </button>

                  {/* Caption */}
                  <div className="mt-3 flex items-start gap-1">
                    <button
                      type="button"
                      tabIndex={-1}
                      onClick={() => router.push(`/notebook/${nb.id}`)}
                      className="flex-1 min-w-0 text-left"
                    >
                      <p className="text-sm font-semibold leading-snug line-clamp-1">{nb.title}</p>
                      <p className="mt-0.5 text-[13px] text-pencil flex items-center gap-x-2.5 gap-y-0.5 flex-wrap">
                        <span className="inline-flex items-center gap-1">
                          <FileText className="w-3.5 h-3.5" />
                          {pageCount} {pageCount === 1 ? 'page' : 'pages'}
                        </span>
                        {memberCount > 1 && (
                          <span className="inline-flex items-center gap-1" title={`${memberCount} people`}>
                            <Users className="w-3.5 h-3.5" />
                            {memberCount}
                          </span>
                        )}
                        {nb.visibility !== 'shared' && (
                          <span className="inline-flex items-center" title="Private">
                            <Lock className="w-3 h-3" />
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-pencil/90 mt-0.5">
                        {isOwner ? timeAgo(nb.updated_at) : `You’re ${nb.user_role === 'editor' ? 'an editor' : `a ${nb.user_role || 'member'}`}`}
                      </p>
                    </button>

                    {isOwner && (
                      <button
                        type="button"
                        onClick={(e) => handleDeleteNotebook(nb.id, nb.title, e)}
                        title={`Delete ${nb.title}`}
                        aria-label={`Delete ${nb.title}`}
                        className="icon-btn icon-btn-sm -mt-1 -mr-1.5 [@media(hover:hover)]:opacity-0 group-hover:opacity-100 focus-visible:opacity-100 hover:!text-correction"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </li>
              );
            })}

            {/* Blank cover = new notebook */}
            <li>
              <button
                type="button"
                onClick={openCreateModal}
                className="w-full aspect-[3/4] rounded-book border-2 border-dashed border-rule text-pencil hover:text-ink hover:border-pencil/60 hover:bg-paper/50 transition-colors flex flex-col items-center justify-center gap-2"
              >
                <Plus className="w-6 h-6" />
                <span className="font-hand text-lg">Start a notebook</span>
              </button>
            </li>
          </ul>
        )}
      </main>

      {/* Create notebook */}
      {showCreateModal && (
        <div className="scrim" onClick={() => setShowCreateModal(false)}>
          <div
            className="index-card sm:max-w-md"
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="index-card-head">
              <div>
                <h2 id="create-title" className="index-card-title">New notebook</h2>
                <p className="text-[13px] text-pencil mt-0.5">It starts with one dotted page. Add more anytime.</p>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="icon-btn icon-btn-sm -mr-1.5"
                title="Close"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateNotebook} className="index-card-body flex flex-col gap-4">
              <div>
                <label htmlFor="nb-title" className="label">Title</label>
                <input
                  id="nb-title"
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="Sprint 14 sketches"
                  className="field"
                  autoFocus
                  required
                />
              </div>

              <div>
                <label htmlFor="nb-desc" className="label">
                  Description <span className="font-normal text-pencil">(optional)</span>
                </label>
                <textarea
                  id="nb-desc"
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  placeholder="What goes in this notebook?"
                  rows={2}
                  className="field"
                />
              </div>

              <fieldset>
                <legend className="label">Who can open it</legend>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: 'private', icon: Lock, title: 'Only me', hint: 'Invite people later' },
                    { id: 'shared', icon: Globe, title: 'Shared', hint: 'Anyone with access' }
                  ].map((opt) => {
                    const Icon = opt.icon;
                    const active = newVisibility === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        aria-pressed={active}
                        onClick={() => setNewVisibility(opt.id)}
                        className={`text-left p-3 rounded-ctl border transition-colors ${
                          active
                            ? 'border-ballpoint bg-ballpoint/[0.06] ring-1 ring-ballpoint'
                            : 'border-rule hover:bg-paper-2'
                        }`}
                      >
                        <span className="flex items-center gap-1.5 text-sm font-semibold">
                          <Icon className="w-4 h-4" />
                          {opt.title}
                        </span>
                        <span className="block text-xs text-pencil mt-0.5">{opt.hint}</span>
                      </button>
                    );
                  })}
                </div>
              </fieldset>

              {createError && (
                <p className="text-[13px] text-correction" role="alert">{createError}</p>
              )}

              <div className="flex items-center justify-end gap-2 pt-1">
                <button type="button" onClick={() => setShowCreateModal(false)} className="btn btn-quiet">
                  Cancel
                </button>
                <button type="submit" disabled={creating || !newTitle.trim()} className="btn btn-primary">
                  {creating ? 'Creating…' : 'Create notebook'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
