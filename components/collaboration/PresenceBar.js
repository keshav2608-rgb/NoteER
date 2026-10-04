'use client';
import React from 'react';
import { useNotebookStore } from '@/lib/store/useNotebookStore';
import { Tablet, Laptop, Users } from 'lucide-react';

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

  return (
    <div className="flex items-center gap-1.5 bg-white/80 backdrop-blur-md px-2.5 py-1 rounded-full border border-slate-200 shadow-xs">
      <Users className="w-3.5 h-3.5 text-slate-400 mr-0.5" />
      
      <div className="flex items-center -space-x-1.5 overflow-hidden">
        {uniqueUsers.slice(0, 5).map((p, idx) => (
          <div
            key={p.clientId || idx}
            title={`${p.user.name} (${p.isTablet ? 'Drawing Tablet' : 'Desktop'}) - ${p.user.role || 'Member'}`}
            className="relative group cursor-pointer"
          >
            {p.user.avatar ? (
              <img
                src={p.user.avatar}
                alt={p.user.name}
                className="w-6 h-6 rounded-full border-2 border-white object-cover shadow-xs"
              />
            ) : (
              <div className="w-6 h-6 rounded-full border-2 border-white bg-indigo-500 text-white text-[10px] font-bold flex items-center justify-center shadow-xs">
                {p.user.name?.charAt(0) || 'U'}
              </div>
            )}

            {p.isTablet && (
              <div className="absolute -bottom-1 -right-1 bg-indigo-600 rounded-full p-0.5 border border-white">
                <Tablet className="w-2.5 h-2.5 text-white" />
              </div>
            )}
          </div>
        ))}
      </div>

      <span className="text-xs font-medium text-slate-600 ml-1">
        {uniqueUsers.length} online
      </span>
    </div>
  );
}
