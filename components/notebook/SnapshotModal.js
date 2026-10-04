'use client';
import React, { useState, useEffect } from 'react';
import {
  History,
  Plus,
  RotateCcw,
  X,
  Clock,
  Calendar,
  Sparkles
} from 'lucide-react';

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

  if (!isOpen) return null;

  const handleCreateSnapshot = async (e) => {
    e.preventDefault();
    setSaving(true);
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
      }
    } catch (err) {
      console.error('Error creating snapshot:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 flex flex-col gap-5">
        
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-amber-50 text-amber-600 rounded-2xl">
              <History className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 leading-tight">Version Snapshots</h2>
              <p className="text-xs text-slate-500">Save checkpoints & restore previous versions</p>
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

        {/* Create Snapshot Form */}
        <form onSubmit={handleCreateSnapshot} className="flex items-center gap-2">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Design review v1, pre-meeting sketch"
            className="flex-1 px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:border-amber-500"
          />
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-1 px-3 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-semibold transition-colors disabled:opacity-50"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{saving ? 'Saving...' : 'Save Checkpoint'}</span>
          </button>
        </form>

        {/* Snapshots List */}
        <div className="flex flex-col gap-2 pt-2 border-t border-slate-100">
          <div className="text-xs font-semibold text-slate-700">Past Versions</div>
          {loading ? (
            <div className="py-8 text-center text-xs text-slate-400">Loading history...</div>
          ) : snapshots.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400">
              No snapshots created yet. Click "Save Checkpoint" above to record current progress.
            </div>
          ) : (
            <div className="flex flex-col gap-2 max-h-56 overflow-y-auto pr-1">
              {snapshots.map((snap) => (
                <div
                  key={snap.id}
                  className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100 hover:border-slate-200 transition-colors"
                >
                  <div className="flex flex-col gap-0.5">
                    <div className="text-xs font-semibold text-slate-900">{snap.title || 'Untitled Checkpoint'}</div>
                    <div className="flex items-center gap-2 text-[11px] text-slate-400">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(snap.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <span>•</span>
                      <span>By {snap.creator_name || 'User'}</span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      if (confirm(`Restore version "${snap.title}"? Current unsaved work will be overwritten.`)) {
                        onRestoreSnapshot(snap);
                        onClose();
                      }
                    }}
                    className="flex items-center gap-1 px-2.5 py-1.5 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-lg text-xs font-semibold transition-colors shadow-2xs"
                  >
                    <RotateCcw className="w-3 h-3 text-slate-500" />
                    <span>Restore</span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
