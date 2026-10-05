'use client';
import React, { useState, useEffect } from 'react';
import { useNotebookStore } from '@/lib/store/useNotebookStore';
import {
  Tablet,
  QrCode,
  Copy,
  Check,
  X,
  RotateCw,
  ExternalLink,
  ShieldCheck,
  Radio
} from 'lucide-react';

export default function PairingModal({ notebookId, isOpen, onClose }) {
  const [pairingData, setPairingData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const { tabletConnected } = useNotebookStore();

  const fetchPairing = () => {
    setLoading(true);
    const origin = typeof window !== 'undefined' ? window.location.origin : '';

    fetch(`/api/notebooks/${notebookId}/pairing`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ origin })
    })
      .then((res) => res.json())
      .then((data) => {
        setPairingData(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to get pairing code:', err);
        setLoading(false);
      });
  };

  useEffect(() => {
    if (!isOpen || !notebookId) return;
    fetchPairing();
  }, [isOpen, notebookId]);

  if (!isOpen) return null;

  const handleCopyLink = () => {
    if (!pairingData?.targetUrl) return;
    navigator.clipboard.writeText(pairingData.targetUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleCopyCode = () => {
    if (!pairingData?.pairingCode) return;
    navigator.clipboard.writeText(pairingData.pairingCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 dark:border-slate-800 flex flex-col gap-4 max-h-[90vh] overflow-y-auto text-slate-900 dark:text-slate-100">
        
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 rounded-2xl">
              <Tablet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white leading-tight">Connect Drawing Tablet</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">Scan QR code or use the 6-digit code</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Live Tablet Status Banner */}
        {tabletConnected ? (
          <div className="flex items-center gap-3 p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-2xl text-emerald-800 dark:text-emerald-200 animate-in fade-in">
            <div className="relative flex items-center justify-center">
              <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
              <div className="absolute w-3 h-3 rounded-full bg-emerald-500 animate-ping"></div>
            </div>
            <div className="text-xs font-semibold">Tablet is actively connected and synchronized!</div>
          </div>
        ) : (
          <div className="flex items-center gap-2 px-3 py-2 bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/40 rounded-xl text-indigo-700 dark:text-indigo-300 text-xs">
            <Radio className="w-3.5 h-3.5 animate-pulse text-indigo-500" />
            <span>Ready for connection • Open camera on your tablet to scan</span>
          </div>
        )}

        {/* QR Code & Code Display */}
        {loading ? (
          <div className="py-12 flex flex-col items-center justify-center gap-3">
            <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-xs text-slate-500 dark:text-slate-400">Generating live pairing session...</p>
          </div>
        ) : pairingData ? (
          <div className="flex flex-col items-center gap-3.5">
            {/* QR Image Card */}
            <div className="p-3 bg-white rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 flex flex-col items-center">
              {pairingData.qrCodeDataUrl ? (
                <img
                  src={pairingData.qrCodeDataUrl}
                  alt="Scan QR code with tablet"
                  className="w-52 h-52 rounded-xl object-contain"
                />
              ) : (
                <div className="w-52 h-52 flex items-center justify-center text-slate-400">
                  <QrCode className="w-16 h-16" />
                </div>
              )}
            </div>

            {/* Numeric PIN with Quick Copy */}
            <div className="flex flex-col items-center gap-1.5 w-full">
              <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Or enter pairing code on tablet
              </span>
              <div className="flex items-center gap-2">
                <div className="text-2xl font-mono font-bold tracking-widest text-slate-900 dark:text-white bg-slate-100 dark:bg-slate-800 px-4 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700">
                  {pairingData.pairingCode}
                </div>
                <button
                  type="button"
                  onClick={handleCopyCode}
                  title="Copy Code"
                  className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors"
                >
                  {copiedCode ? <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Direct Link Actions */}
            <div className="w-full flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={handleCopyLink}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-xl text-xs font-semibold transition-colors"
              >
                {copiedLink ? <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" /> : <Copy className="w-4 h-4" />}
                <span>{copiedLink ? 'Link Copied to Clipboard!' : 'Copy Direct Link'}</span>
              </button>

              <a
                href={pairingData.targetUrl}
                target="_blank"
                rel="noreferrer"
                className="p-2.5 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/80 text-indigo-600 dark:text-indigo-400 rounded-xl transition-colors"
                title="Open Remote Pad in new tab (test mode)"
              >
                <ExternalLink className="w-4 h-4" />
              </a>

              <button
                type="button"
                onClick={fetchPairing}
                className="p-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl transition-colors"
                title="Generate new pairing code"
              >
                <RotateCw className="w-4 h-4" />
              </button>
            </div>
          </div>
        ) : (
          <div className="py-6 text-center text-xs text-rose-500 dark:text-rose-400">
            Failed to generate pairing code. Please try again.
          </div>
        )}

        {/* Ephemeral Session Notice */}
        <div className="flex items-center gap-2 p-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-2xl text-[11px] text-slate-600 dark:text-slate-300">
          <ShieldCheck className="w-4 h-4 text-indigo-500 shrink-0" />
          <span>This pairing code is strictly temporary and stays active only while this notebook is open.</span>
        </div>
      </div>
    </div>
  );
}
