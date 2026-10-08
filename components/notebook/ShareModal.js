'use client';
import React, { useState, useEffect, useRef } from 'react';
import {
  UserPlus,
  Trash2,
  X,
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

  // Escape closes. The listener must stay attached for the whole time the modal
  // is open: other window keydown handlers (e.g. the canvas tool shortcuts)
  // trigger synchronous store re-renders mid-dispatch, and re-subscribing on
  // every new inline onClose would drop this listener before it runs.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onCloseRef.current?.();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

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
      setSuccess(`Invited ${email.trim()}`);
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.message || 'Couldn’t send the invite. Check the email address and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const isShared = notebook?.visibility === 'shared';
  const roleLabel = { owner: 'Owner', editor: 'Can edit', commenter: 'Can comment', viewer: 'Can view' };

  return (
    <div onClick={onClose} className="scrim select-none">
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="share-title"
        className="index-card sm:max-w-lg"
      >
        <div className="index-card-head">
          <div className="min-w-0">
            <h2 id="share-title" className="index-card-title">Share notebook</h2>
            <p className="text-sm text-pencil mt-0.5 truncate">{notebook?.title}</p>
          </div>
          <button type="button" onClick={onClose} className="icon-btn icon-btn-sm -mr-2" title="Close" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="index-card-body flex flex-col gap-6">
          {/* Visibility */}
          {isOwner && (
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-start gap-3 min-w-0">
                {isShared ? (
                  <Globe className="w-5 h-5 text-ballpoint shrink-0 mt-0.5" />
                ) : (
                  <Lock className="w-5 h-5 text-pencil shrink-0 mt-0.5" />
                )}
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-ink">
                    {isShared ? 'Shared with members' : 'Private'}
                  </div>
                  <div className="text-sm text-pencil">
                    {isShared ? 'People you invite can open it.' : 'Only you can open it.'}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => onUpdateVisibility(isShared ? 'private' : 'shared')}
                className="btn btn-outline btn-sm shrink-0"
              >
                {isShared ? 'Make private' : 'Share it'}
              </button>
            </div>
          )}

          {/* Invite */}
          {isOwner && (
            <form onSubmit={handleInvite} className="flex flex-col gap-2">
              <label htmlFor="share-email" className="label mb-0">Invite by email</label>
              <div className="flex flex-col sm:flex-row gap-2">
                <div className="relative flex-1">
                  <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-pencil pointer-events-none" />
                  <input
                    id="share-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@example.com"
                    className="field pl-9"
                    required
                  />
                </div>
                <div className="flex gap-2">
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    aria-label="Access level"
                    className="field flex-1 sm:w-auto cursor-pointer"
                  >
                    <option value="editor">Can edit</option>
                    <option value="commenter">Can comment</option>
                    <option value="viewer">Can view</option>
                  </select>
                  <button type="submit" disabled={submitting} className="btn btn-primary">
                    <UserPlus className="w-4 h-4" />
                    {submitting ? 'Inviting…' : 'Invite'}
                  </button>
                </div>
              </div>
              {error && <div role="alert" className="text-sm text-correction">{error}</div>}
              {success && <div role="status" className="text-sm text-ok">{success}</div>}
            </form>
          )}

          {/* Members */}
          <div className="flex flex-col gap-1">
            <div className="flex items-baseline justify-between pb-2 border-b border-rule">
              <span className="text-sm font-semibold text-ink">People with access</span>
              <span className="text-sm text-pencil tabular-nums">{members.length}</span>
            </div>
            <ul className="flex flex-col max-h-56 overflow-y-auto -mx-2">
              {members.map((m) => (
                <li
                  key={m.member_id || m.id || m.user_id}
                  className="flex items-center justify-between gap-3 px-2 py-2 rounded-ctl hover:bg-paper-2 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {m.avatar_url ? (
                      <img src={m.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover border border-rule shrink-0" />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-ink text-paper text-sm font-bold flex items-center justify-center shrink-0">
                        {m.name?.charAt(0) || 'U'}
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-ink truncate">{m.name}</div>
                      <div className="text-xs text-pencil truncate">{m.email}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <span className={m.role === 'owner' ? 'chip hl border-transparent' : 'chip'}>
                      {roleLabel[m.role] || m.role}
                    </span>
                    {isOwner && m.role !== 'owner' && (
                      <button
                        type="button"
                        onClick={() => onRemoveMember(m.user_id)}
                        className="icon-btn icon-btn-sm hover:text-correction"
                        title={`Remove ${m.name}`}
                        aria-label={`Remove ${m.name}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
