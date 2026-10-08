'use client';
import React, { useState, useEffect, useRef } from 'react';
import { Plus, RotateCcw, X } from 'lucide-react';

function formatWhen(value) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const time = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  const today = new Date();
  if (d.toDateString() === today.toDateString()) return `Today, ${time}`;
  return `${d.toLocaleDateString([], { month: 'short', day: 'numeric' })}, ${time}`;
}

export default function SnapshotModal({
  notebookId,
  pageId,
  currentDocumentState,
  isOpen,
  onClose,
  onRestoreSnapshot
}) {
  const [snapshots, setSnapshots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  useEffect(() => {
    if (!isOpen || !notebookId) return;

    setLoading(true);
    fetch(`/api/notebooks/${notebookId}/snapshots`)
      .then((res) => res.json())
      .then((data) => {
        setSnapshots(data.snapshots || []);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load snapshots:', err);
        setLoading(false);
      });
  }, [isOpen, notebookId]);

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

  const handleCreateSnapshot = async (e) => {
    e.preventDefault();
    setSaving(true);
    setSaveError('');
    try {
      const res = await fetch(`/api/notebooks/${notebookId}/snapshots`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pageId,
          title: title.trim() || undefined,
          snapshotData: currentDocumentState
        })
      });
      if (res.ok) {
        const data = await res.json();
        setSnapshots([data.snapshot, ...snapshots]);
        setTitle('');
      } else {
        setSaveError('Couldn’t save this version. Check your connection and try again.');
      }
    } catch (err) {
      console.error('Error creating snapshot:', err);
      setSaveError('Couldn’t save this version. Check your connection and try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div onClick={onClose} className="scrim select-none">
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="snapshot-title"
        className="index-card sm:max-w-md"
      >
        <div className="index-card-head">
          <div>
            <h2 id="snapshot-title" className="index-card-title">Saved versions</h2>
            <p className="text-sm text-pencil mt-0.5">Save this page as it is now, and go back to it later.</p>
          </div>
          <button type="button" onClick={onClose} className="icon-btn icon-btn-sm -mr-2" title="Close" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="index-card-body flex flex-col gap-5">
          <form onSubmit={handleCreateSnapshot} className="flex flex-col gap-2">
            <div className="flex gap-2">
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Name this version (optional)"
                aria-label="Version name"
                className="field flex-1 min-w-0"
              />
              <button type="submit" disabled={saving} className="btn btn-primary shrink-0">
                <Plus className="w-4 h-4" />
                {saving ? 'Saving…' : 'Save version'}
              </button>
            </div>
            {saveError && <div role="alert" className="text-sm text-correction">{saveError}</div>}
          </form>

          <div className="flex flex-col">
            <div className="text-sm font-semibold text-ink pb-2 border-b border-rule">Earlier versions</div>
            {loading ? (
              <div className="py-8 text-center text-sm text-pencil">Loading versions…</div>
            ) : snapshots.length === 0 ? (
              <div className="py-8 text-center text-sm text-pencil">
                No saved versions yet. Save one above before a big change.
              </div>
            ) : (
              <ul className="flex flex-col max-h-64 overflow-y-auto">
                {snapshots.map((snap) => (
                  <li
                    key={snap.id}
                    className="flex items-center justify-between gap-3 py-3 border-b border-rule last:border-b-0"
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-ink truncate">{snap.title || 'Untitled version'}</div>
                      <div className="text-xs text-pencil truncate">
                        {formatWhen(snap.created_at)}{snap.creator_name ? `, by ${snap.creator_name}` : ''}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm(`Restore “${snap.title || 'Untitled version'}”? The page will be replaced with this version.`)) {
                          onRestoreSnapshot(snap);
                          onClose();
                        }
                      }}
                      className="btn btn-outline btn-sm shrink-0"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      Restore
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
