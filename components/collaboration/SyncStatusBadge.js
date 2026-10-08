'use client';
import React from 'react';
import { useNotebookStore } from '@/lib/store/useNotebookStore';
import { Check, RefreshCw, WifiOff, AlertCircle, Tablet } from 'lucide-react';

const STATUS = {
  saved: { icon: Check, text: 'Saved', tone: 'text-ok' },
  syncing: { icon: RefreshCw, text: 'Saving…', tone: 'text-ballpoint', spin: true },
  reconnecting: { icon: AlertCircle, text: 'Reconnecting…', tone: 'text-pencil', pulse: true },
  offline: { icon: WifiOff, text: 'Offline, saved on this device', short: 'Offline', tone: 'text-correction' }
};

export default function SyncStatusBadge() {
  const { syncStatus, tabletConnected } = useNotebookStore();
  const config = STATUS[syncStatus] || STATUS.offline;
  const Icon = config.icon;

  return (
    <div className="flex items-center gap-2" role="status" aria-live="polite">
      <div
        title={config.text}
        className={`flex items-center gap-1.5 text-[13px] font-medium ${config.tone} ${config.pulse ? 'animate-pulse-subtle' : ''}`}
      >
        <Icon className={`w-4 h-4 shrink-0 ${config.spin ? 'animate-spin' : ''}`} aria-hidden="true" />
        <span className="hidden sm:inline whitespace-nowrap">
          <span className="hidden xl:inline">{config.text}</span>
          <span className="xl:hidden">{config.short || config.text}</span>
        </span>
        <span className="sr-only sm:hidden">{config.text}</span>
      </div>

      {tabletConnected && (
        <div
          title="A tablet is drawing on this page"
          className="hidden sm:flex items-center gap-1.5 h-7 px-2 rounded-ctl hl text-[13px] font-semibold"
        >
          <Tablet className="w-3.5 h-3.5" aria-hidden="true" />
          <span className="hidden lg:inline">Tablet live</span>
        </div>
      )}
    </div>
  );
}
