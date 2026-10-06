'use client';
import React, { useState } from 'react';
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
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/60 backdrop-blur-md animate-in fade-in select-none"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white/98 dark:bg-slate-900/98 rounded-[2rem] max-w-lg w-full p-6 shadow-2xl border border-slate-200/90 dark:border-slate-800 ring-1 ring-black/5 dark:ring-white/10 flex flex-col gap-5 text-slate-900 dark:text-slate-100 animate-in zoom-in-95 duration-200"
      >
        
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 rounded-2xl">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white leading-tight">Share Notebook</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">{notebook?.title}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Notebook Visibility Toggle (Private / Shared) */}
        {isOwner && (
          <div className="flex items-center justify-between p-3.5 bg-slate-50 dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-2.5">
              {notebook?.visibility === 'shared' ? (
                <Globe className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <Lock className="w-4 h-4 text-slate-600 dark:text-slate-400" />
              )}
              <div>
                <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                  {notebook?.visibility === 'shared' ? 'Shared with Collaborators' : 'Private Notebook'}
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400">
                  {notebook?.visibility === 'shared'
                    ? 'Only invited members can view or edit'
                    : 'Only you have access to this notebook'}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => onUpdateVisibility(notebook.visibility === 'shared' ? 'private' : 'shared')}
              className="text-xs font-semibold px-3 py-1.5 rounded-xl bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-600 text-slate-900 dark:text-slate-100 transition-colors"
            >
              Make {notebook?.visibility === 'shared' ? 'Private' : 'Shared'}
            </button>
          </div>
        )}

        {/* Invite Form */}
        {isOwner && (
          <form onSubmit={handleInvite} className="flex flex-col gap-2">
            <div className="text-xs font-semibold text-slate-700 dark:text-slate-300">Invite new collaborator</div>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="collaborator@email.com"
                  className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
                  required
                />
              </div>

              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="py-2 px-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-medium focus:outline-none"
              >
                <option value="editor">Editor (Draw & Edit)</option>
                <option value="commenter">Commenter</option>
                <option value="viewer">Viewer (Read-only)</option>
              </select>

              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold transition-colors disabled:opacity-50"
              >
                {submitting ? 'Inviting...' : 'Invite'}
              </button>
            </div>

            {error && <div className="text-xs text-rose-500 dark:text-rose-400">{error}</div>}
            {success && <div className="text-xs text-emerald-600 dark:text-emerald-400">{success}</div>}
          </form>
        )}

        {/* Members List */}
        <div className="flex flex-col gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
          <div className="text-xs font-semibold text-slate-700 dark:text-slate-300">Members with access</div>
          <div className="flex flex-col gap-1.5 max-h-48 overflow-y-auto pr-1">
            {members.map((m) => (
              <div
                key={m.member_id || m.id || m.user_id}
                className="flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors border border-transparent hover:border-slate-100 dark:hover:border-slate-800"
              >
                <div className="flex items-center gap-2.5">
                  {m.avatar_url ? (
                    <img src={m.avatar_url} alt={m.name} className="w-8 h-8 rounded-full object-cover" />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold flex items-center justify-center">
                      {m.name?.charAt(0) || 'U'}
                    </div>
                  )}
                  <div>
                    <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">{m.name}</div>
                    <div className="text-[11px] text-slate-400 dark:text-slate-500">{m.email}</div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                    m.role === 'owner' ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300' :
                    m.role === 'editor' ? 'bg-indigo-100 dark:bg-indigo-950/60 text-indigo-800 dark:text-indigo-300' :
                    'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                  }`}>
                    {m.role}
                  </span>

                  {isOwner && m.role !== 'owner' && (
                    <button
                      type="button"
                      onClick={() => onRemoveMember(m.user_id)}
                      className="p-1 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 transition-colors"
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
  );
}
