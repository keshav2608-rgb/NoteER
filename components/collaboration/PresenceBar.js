'use client';
import React from 'react';
import { useNotebookStore } from '@/lib/store/useNotebookStore';
import { Tablet } from 'lucide-react';

const AVATAR_TINTS = ['#2340C8', '#2F6B4F', '#B5452F', '#6B4E9B', '#8A6A1F', '#2C6C7A'];

export default function PresenceBar({ currentUser }) {
  const { peers } = useNotebookStore();

  // Deduplicate peers by userId
  const uniqueUsers = [];
  const seenUserIds = new Set();
  const peerList = Array.isArray(peers) ? peers : [];

  for (const peer of peerList) {
    if (peer?.user?.id && !seenUserIds.has(peer.user.id)) {
      seenUserIds.add(peer.user.id);
      uniqueUsers.push(peer);
    }
  }

  if (uniqueUsers.length === 0) return null;

  return (
    <div className="flex items-center gap-2" title={`${uniqueUsers.length} here now`}>
      <div className="flex items-center -space-x-2">
        {uniqueUsers.slice(0, 5).map((p, idx) => (
          <div
            key={p.clientId || idx}
            title={`${p.user.name} on ${p.isTablet ? 'a tablet' : 'a computer'}`}
            className="relative"
          >
            {p.user.avatar ? (
              <img
                src={p.user.avatar}
                alt={p.user.name}
                className="w-7 h-7 rounded-full border-2 border-paper object-cover"
              />
            ) : (
              <div
                className="w-7 h-7 rounded-full border-2 border-paper text-white text-xs font-bold flex items-center justify-center"
                style={{ backgroundColor: AVATAR_TINTS[idx % AVATAR_TINTS.length] }}
              >
                {p.user.name?.charAt(0) || 'U'}
              </div>
            )}

            {p.isTablet && (
              <div className="absolute -bottom-1 -right-1 bg-paper text-ink rounded-full p-0.5 border border-rule">
                <Tablet className="w-2.5 h-2.5" />
              </div>
            )}
          </div>
        ))}
      </div>
      <span className="text-[13px] text-pencil whitespace-nowrap">
        {uniqueUsers.length} here
      </span>
    </div>
  );
}
