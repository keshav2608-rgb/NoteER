'use client';
import React, { useState, useEffect, useRef } from 'react';
import { Bell, CheckCheck } from 'lucide-react';

function formatWhen(value) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const time = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  if (d.toDateString() === new Date().toDateString()) return time;
  return `${d.toLocaleDateString([], { month: 'short', day: 'numeric' })}, ${time}`;
}

export default function NotificationCenter() {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const rootRef = useRef(null);

  // Close on outside click / tap and on Escape
  useEffect(() => {
    if (!isOpen) return;
    const onPointer = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setIsOpen(false);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('pointerdown', onPointer);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      window.removeEventListener('keydown', onKey);
    };
  }, [isOpen]);

  const fetchNotifications = async () => {
    try {
      const res = await fetch('/api/notifications');
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications || []);
        setUnreadCount(data.unreadCount || 0);
      }
    } catch (err) {
      console.error('Failed to load notifications:', err);
    }
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 15000); // Poll every 15s
    return () => clearInterval(interval);
  }, []);

  const handleMarkAllRead = async () => {
    try {
      await fetch('/api/notifications/all/read', { method: 'POST' });
      setUnreadCount(0);
      setNotifications((prev) => prev.map(n => ({ ...n, read_at: n.read_at || new Date().toISOString() })));
    } catch (err) {
      console.error('Failed to mark all read:', err);
    }
  };

  const handleMarkRead = async (id) => {
    try {
      await fetch(`/api/notifications/${id}/read`, { method: 'POST' });
      setNotifications((prev) => prev.map(n => n.id === id ? { ...n, read_at: new Date().toISOString() } : n));
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch (err) {
      console.error('Failed to mark read:', err);
    }
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="icon-btn relative"
        title="Notifications"
        aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'}
        aria-expanded={isOpen}
      >
        <Bell className="w-[18px] h-[18px]" />
        {unreadCount > 0 && (
          <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-correction rounded-full ring-2 ring-paper" />
        )}
      </button>

      {isOpen && (
        <div className="menu fixed left-3 right-3 top-16 sm:absolute sm:left-auto sm:right-0 sm:top-full sm:mt-2 sm:w-96 z-50 p-0 overflow-hidden">
          <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-rule">
            <span className="text-sm font-semibold text-ink">
              Notifications
              {unreadCount > 0 && <span className="ml-2 text-pencil font-normal tabular-nums">{unreadCount} new</span>}
            </span>
            {unreadCount > 0 && (
              <button type="button" onClick={handleMarkAllRead} className="btn btn-quiet btn-sm -mr-2">
                <CheckCheck className="w-4 h-4" />
                Mark all read
              </button>
            )}
          </div>

          <div className="flex flex-col max-h-[min(22rem,60dvh)] overflow-y-auto p-1.5">
            {notifications.length === 0 ? (
              <div className="py-10 px-4 text-center text-sm text-pencil">
                You’re all caught up. Invites and shares will show up here.
              </div>
            ) : (
              notifications.map((n) => {
                let payload = {};
                try {
                  payload = typeof n.payload === 'string' ? JSON.parse(n.payload) : (n.payload || {});
                } catch {
                  payload = { message: n.payload };
                }

                return (
                  <button
                    type="button"
                    key={n.id}
                    onClick={() => !n.read_at && handleMarkRead(n.id)}
                    className={`flex items-start gap-3 px-3 py-2.5 rounded-ctl text-left transition-colors hover:bg-paper-2 ${
                      n.read_at ? 'cursor-default' : 'cursor-pointer'
                    }`}
                  >
                    <span
                      className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${n.read_at ? 'bg-transparent' : 'bg-ballpoint'}`}
                      aria-hidden="true"
                    />
                    <span className="flex-1 min-w-0">
                      <span className={`block text-sm leading-snug ${n.read_at ? 'text-pencil' : 'text-ink'}`}>
                        {payload.message || 'Something changed in one of your notebooks.'}
                      </span>
                      <span className="block mt-0.5 text-xs text-pencil">{formatWhen(n.created_at)}</span>
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
