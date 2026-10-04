'use client';
import React from 'react';
import { useNotebookStore } from '@/lib/store/useNotebookStore';
import { CheckCircle2, RefreshCw, WifiOff, AlertCircle } from 'lucide-react';

export default function SyncStatusBadge() {
  const { syncStatus, tabletConnected } = useNotebookStore();

  const getStatusConfig = () => {
    switch (syncStatus) {
      case 'saved':
        return {
          icon: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />,
          text: 'Saved',
          bg: 'bg-emerald-50/80 text-emerald-700 border-emerald-200/60'
        };
      case 'syncing':
        return {
          icon: <RefreshCw className="w-3.5 h-3.5 text-blue-500 animate-spin" />,
          text: 'Syncing...',
          bg: 'bg-blue-50/80 text-blue-700 border-blue-200/60'
        };
      case 'reconnecting':
        return {
          icon: <AlertCircle className="w-3.5 h-3.5 text-amber-500 animate-pulse" />,
          text: 'Reconnecting...',
          bg: 'bg-amber-50/80 text-amber-700 border-amber-200/60'
        };
      case 'offline':
      default:
        return {
          icon: <WifiOff className="w-3.5 h-3.5 text-rose-500" />,
          text: 'Offline — saved locally',
          bg: 'bg-rose-50/80 text-rose-700 border-rose-200/60'
        };
    }
  };

  const config = getStatusConfig();

  return (
    <div className="flex items-center gap-2">
      <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border backdrop-blur-sm shadow-xs ${config.bg}`}>
        {config.icon}
        <span>{config.text}</span>
      </div>

      {tabletConnected && (
        <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-indigo-50/90 text-indigo-700 border border-indigo-200/70 shadow-xs animate-pulse-subtle">
          <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
          <span>Tablet Active</span>
        </div>
      )}
    </div>
  );
}
