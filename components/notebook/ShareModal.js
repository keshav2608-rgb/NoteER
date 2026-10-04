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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 flex flex-col gap-5">
        
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-blue-50 text-blue-600 rounded-2xl">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 leading-tight">Share Notebook</h2>
              <p className="text-xs text-slate-500">{notebook?.title}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Notebook Visibility Toggle (Private / Shared) */}
        {isOwner && (
          <div className="flex items-center justify-between p-3.5 bg-slate-50 rounded-2xl border border-slate-200">
            <div className="flex items-center gap-2.5">
              {notebook?.visibility === 'shared' ? (
                <Globe className="w-4 h-4 text-emerald-600" />
              ) : (
                <Lock className="w-4 h-4 text-slate-600" />
              )}
              <div>
                <div className="text-xs font-semibold text-slate-800">
                  {notebook?.visibility === 'shared' ? 'Shared with Collaborators' : 'Private Notebook'}
                </div>
                <div className="text-[11px] text-slate-500">
                  {notebook?.visibility === 'shared'
                    ? 'Only invited members can view or edit'
                    : 'Only you have access to this notebook'}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => onUpdateVisibility(notebook.visibility === 'shared' ? 'private' : 'shared')}
              className="text-xs font-semibold px-3 py-1.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 transition-colors"
            >
              Make {notebook?.visibility === 'shared' ? 'Private' : 'Shared'}
            </button>
          </div>
        )}

        {/* Invite Form */}
        {isOwner && (
          <form onSubmit={handleInvite} className="flex flex-col gap-2">
            <div className="text-xs font-semibold text-slate-700">Invite new collaborator</div>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="collaborator@email.com"
                  className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:border-indigo-500"
                  required
                />
              </div>

              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="py-2 px-2.5 text-xs rounded-xl border border-slate-200 bg-white font-medium focus:outline-none"
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

            {error && <div className="text-xs text-rose-500">{error}</div>}
            {success && <div className="text-xs text-emerald-600">{success}</div>}
          </form>
        )}

        {/* Members List */}
        <div className="flex flex-col gap-2 pt-2 border-t border-slate-100">
          <div className="text-xs font-semibold text-slate-700">Members with access</div>
          <div className="flex flex-col gap-1.5 max-h-48 overflow-y-auto pr-1">
            {members.map((m) => (
              <div
                key={m.member_id || m.id || m.user_id}
                className="flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-50 transition-colors border border-transparent hover:border-slate-100"
              >
                <div className="flex items-center gap-2.5">
                  {m.avatar_url ? (
                    <img src={m.avatar_url} alt={m.name} className="w-8 h-8 rounded-full object-cover" />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-slate-200 text-slate-700 text-xs font-bold flex items-center justify-center">
                      {m.name?.charAt(0) || 'U'}
                    </div>
                  )}
                  <div>
                    <div className="text-xs font-semibold text-slate-800">{m.name}</div>
                    <div className="text-[11px] text-slate-400">{m.email}</div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                    m.role === 'owner' ? 'bg-amber-100 text-amber-800' :
                    m.role === 'editor' ? 'bg-indigo-100 text-indigo-800' :
                    'bg-slate-100 text-slate-700'
                  }`}>
                    {m.role}
                  </span>

                  {isOwner && m.role !== 'owner' && (
                    <button
                      type="button"
                      onClick={() => onRemoveMember(m.user_id)}
                      className="p-1 text-slate-400 hover:text-rose-600 transition-colors"
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
