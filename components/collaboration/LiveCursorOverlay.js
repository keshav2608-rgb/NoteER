'use client';
import React from 'react';
import { useNotebookStore } from '@/lib/store/useNotebookStore';
import { worldToScreen } from '@/lib/drawing/engine';
import { MousePointer2, Tablet } from 'lucide-react';

const USER_COLORS = [
  '#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4'
];

export default function LiveCursorOverlay({ currentClientId }) {
  const { peers, zoom, panX, panY } = useNotebookStore();
  const peerList = Array.isArray(peers) ? peers : [];

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-20">
      {peerList
        .filter((peer) => peer && peer.clientId !== currentClientId && peer.cursor)
        .map((peer, idx) => {
          const screenPos = worldToScreen(peer.cursor.x, peer.cursor.y, zoom, panX, panY);
          const color = USER_COLORS[idx % USER_COLORS.length];
          const name = peer.user?.name?.split(' ')[0] || 'Peer';

          return (
            <div
              key={peer.clientId}
              className="absolute transition-transform duration-75 ease-out flex items-start gap-1"
              style={{
                transform: `translate3d(${screenPos.x}px, ${screenPos.y}px, 0)`,
                willChange: 'transform'
              }}
            >
              {peer.isTablet ? (
                <div 
                  className="p-1 rounded-full shadow-md text-white flex items-center justify-center"
                  style={{ backgroundColor: color }}
                >
                  <Tablet className="w-3.5 h-3.5" />
                </div>
              ) : (
                <MousePointer2
                  className="w-4 h-4 drop-shadow-sm"
                  style={{ color, fill: color }}
                />
              )}

              <span
                className="text-[10px] font-semibold text-white px-1.5 py-0.5 rounded shadow-sm whitespace-nowrap"
                style={{ backgroundColor: color }}
              >
                {name} {peer.isTablet ? '(Tablet)' : ''}
              </span>
            </div>
          );
        })}
    </div>
  );
}
