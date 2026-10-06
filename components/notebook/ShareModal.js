'use client';
import React, { useState, useEffect } from 'react';
import {
  Users,
  UserPlus,
  Shield,
  Trash2,
  X,
  Check,
  Mail,
  Lock,
  Globe
} from 'lucide-react';

export default function ShareModal({
  notebook,
  members = [],
  currentUser,
  isOpen,
  onClose,
  onAddMember,
  onRemoveMember,
  onUpdateVisibility
}) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('editor');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Escape key handler
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const isOwner = notebook?.owner_id === currentUser?.id;

  const handleInvite = async (e) => {
    e.preventDefault();
    if (!email.trim()) return;

    setSubmitting(true);
    setError('');
    setSuccess('');

    try {
      await onAddMember(email.trim(), role);
      setEmail('');
      setSuccess(`Invited ${email} as ${role}`);
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.message || 'Failed to add collaborator');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/60 backdrop-blur-md animate-in fade-in select-none"
    >
      {/* Outer Shell */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="max-w-lg w-full p-1.5 sm:p-2.5 rounded-[2.25rem] bg-slate-900/5 dark:bg-white/[0.04] border border-slate-200/80 dark:border-white/[0.08] shadow-2xl backdrop-blur-2xl ring-1 ring-black/5 dark:ring-white/5 animate-in zoom-in-95 duration-200"
      >
        {/* Inner Core */}
        <div className="rounded-[1.85rem] bg-white dark:bg-[#0c0e15] border border-slate-200/70 dark:border-white/[0.06] p-6 text-slate-900 dark:text-slate-100 flex flex-col gap-5 shadow-sm">
          
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center border border-indigo-200/60 dark:border-indigo-800/60 shadow-xs">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <div className="text-[10px] font-mono font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">
                  COLLABORATION
                </div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white leading-tight">
                  Share Notebook
                </h2>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 font-medium truncate max-w-[240px]">
                  {notebook?.title}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-colors cursor-pointer"
              title="Close (Esc)"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Notebook Visibility Toggle (Private / Shared) */}
          {isOwner && (
            <div className="flex items-center justify-between p-3.5 bg-slate-50/80 dark:bg-[#11131c] rounded-2xl border border-slate-200/80 dark:border-white/[0.06]">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 text-indigo-600 dark:text-indigo-400 shrink-0">
                  {notebook?.visibility === 'shared' ? (
                    <Globe className="w-4 h-4 text-emerald-500" />
                  ) : (
                    <Lock className="w-4 h-4 text-slate-400" />
                  )}
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    {notebook?.visibility === 'shared' ? 'Shared with Collaborators' : 'Private Notebook'}
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    {notebook?.visibility === 'shared'
                      ? 'Invited members can view or draw live'
                      : 'Only you have access to this notebook'}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => onUpdateVisibility(notebook.visibility === 'shared' ? 'private' : 'shared')}
                className="text-xs font-bold px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-indigo-400 dark:hover:border-indigo-500 text-slate-900 dark:text-slate-100 transition-colors shadow-2xs cursor-pointer active:scale-95"
              >
                Make {notebook?.visibility === 'shared' ? 'Private' : 'Shared'}
              </button>
            </div>
          )}

          {/* Invite Form */}
          {isOwner && (
            <form onSubmit={handleInvite} className="flex flex-col gap-2">
              <div className="text-xs font-bold text-slate-700 dark:text-slate-300">Invite new collaborator</div>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <div className="relative flex-1">
                  <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="collaborator@email.com"
                    className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-[#11131c] text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
                    required
                  />
                </div>

                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="py-2 px-3 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-[#11131c] text-slate-900 dark:text-white font-medium focus:outline-none cursor-pointer"
                >
                  <option value="editor">Editor (Draw & Edit)</option>
                  <option value="commenter">Commenter</option>
                  <option value="viewer">Viewer (Read-only)</option>
                </select>

                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm shadow-indigo-500/20 disabled:opacity-50 cursor-pointer active:scale-95"
                >
                  {submitting ? 'Inviting...' : 'Invite'}
                </button>
              </div>

              {error && <div className="text-xs text-rose-500 dark:text-rose-400 font-semibold">{error}</div>}
              {success && <div className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold">{success}</div>}
            </form>
          )}

          {/* Members List */}
          <div className="flex flex-col gap-2 pt-2 border-t border-slate-100 dark:border-slate-800/80">
            <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
              <span>Members with access</span>
              <span className="text-[10px] font-mono font-normal text-slate-400">({members.length})</span>
            </div>
            <div className="flex flex-col gap-1.5 max-h-48 overflow-y-auto pr-1">
              {members.map((m) => (
                <div
                  key={m.member_id || m.id || m.user_id}
                  className="flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-[#11131c] transition-colors border border-transparent hover:border-slate-100 dark:hover:border-white/[0.04]"
                >
                  <div className="flex items-center gap-2.5">
                    {m.avatar_url ? (
                      <img src={m.avatar_url} alt={m.name} className="w-8 h-8 rounded-full object-cover ring-1 ring-slate-200 dark:ring-slate-700" />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-indigo-600 text-white text-xs font-bold flex items-center justify-center shadow-2xs">
                        {m.name?.charAt(0) || 'U'}
                      </div>
                    )}
                    <div>
                      <div className="text-xs font-bold text-slate-800 dark:text-slate-200">{m.name}</div>
                      <div className="text-[11px] text-slate-400 dark:text-slate-500 font-mono">{m.email}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded-md text-[9px] font-mono font-bold uppercase tracking-wider ${
                      m.role === 'owner' ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200/60' :
                      m.role === 'editor' ? 'bg-indigo-100 dark:bg-indigo-950/60 text-indigo-800 dark:text-indigo-300 border border-indigo-200/60' :
                      'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                    }`}>
                      {m.role}
                    </span>

                    {isOwner && m.role !== 'owner' && (
                      <button
                        type="button"
                        onClick={() => onRemoveMember(m.user_id)}
                        className="p-1 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 transition-colors cursor-pointer"
                        title="Remove member"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
