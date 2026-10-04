'use client';
import React, { useState, useEffect } from 'react';
import { useNotebookStore } from '@/lib/store/useNotebookStore';
import {
  Tablet,
  QrCode,
  Copy,
  Check,
  X,
  Sparkles,
  Smartphone,
  ExternalLink
} from 'lucide-react';

export default function PairingModal({ notebookId, isOpen, onClose }) {
  const [pairingData, setPairingData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [selectedIp, setSelectedIp] = useState('');
  const [showNetworkSettings, setShowNetworkSettings] = useState(false);
  const { tabletConnected } = useNotebookStore();

  const fetchPairing = (ipOverride = '') => {
    setLoading(true);
    const url = ipOverride
      ? `/api/notebooks/${notebookId}/pairing?ip=${encodeURIComponent(ipOverride)}`
      : `/api/notebooks/${notebookId}/pairing`;

    fetch(url, { method: 'POST' })
      .then((res) => res.json())
      .then((data) => {
        setPairingData(data);
        if (data.resolvedIp && !ipOverride) {
          setSelectedIp(data.resolvedIp);
        }
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
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleIpChange = (ip) => {
    setSelectedIp(ip);
    fetchPairing(ip);
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
              <p className="text-xs text-slate-500 dark:text-slate-400">Live multi-device canvas synchronization</p>
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
          <div className="flex items-center gap-3 p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-2xl text-emerald-800 dark:text-emerald-200">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping"></div>
            <div className="text-xs font-semibold">Tablet is actively connected and synchronized!</div>
          </div>
        ) : null}

        {/* QR Code & Code Display */}
        {loading ? (
          <div className="py-12 flex flex-col items-center justify-center gap-3">
            <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-xs text-slate-500 dark:text-slate-400">Generating secure pairing session...</p>
          </div>
        ) : pairingData ? (
          <div className="flex flex-col items-center gap-3">
            {/* QR Image */}
            <div className="p-3 bg-white rounded-2xl shadow-inner border border-slate-200 dark:border-slate-700">
              {pairingData.qrCodeDataUrl ? (
                <img
                  src={pairingData.qrCodeDataUrl}
                  alt="Scan QR code with tablet"
                  className="w-48 h-48 rounded-xl object-contain"
                />
              ) : (
                <div className="w-48 h-48 flex items-center justify-center text-slate-400">
                  <QrCode className="w-16 h-16" />
                </div>
              )}
            </div>

            {/* Direct URL Preview */}
            <div className="w-full text-center px-2">
              <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono break-all select-all bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 py-1 px-2.5 rounded-lg inline-block">
                {pairingData.targetUrl}
              </span>
            </div>

            {/* Numeric PIN */}
            <div className="flex flex-col items-center gap-1">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Or enter 6-digit code on tablet
              </span>
              <div className="text-2xl font-mono font-bold tracking-widest text-slate-900 dark:text-white bg-slate-100 dark:bg-slate-800 px-4 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700">
                {pairingData.pairingCode}
              </div>
            </div>

            {/* Network / IP Selector */}
            {pairingData.detectedIps && pairingData.detectedIps.length > 0 && (
              <div className="w-full">
                <button
                  type="button"
                  onClick={() => setShowNetworkSettings(!showNetworkSettings)}
                  className="text-[11px] text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 font-medium flex items-center justify-center gap-1 w-full text-center py-1"
                >
                  <span>{showNetworkSettings ? 'Hide Network IP Settings' : `Connected via IP: ${pairingData.resolvedIp || 'auto'}`}</span>
                </button>

                {showNetworkSettings && (
                  <div className="mt-2 p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl flex flex-col gap-2 text-xs">
                    <span className="font-semibold text-slate-700 dark:text-slate-300">Select Laptop IP Address:</span>
                    <div className="flex flex-col gap-1.5">
                      {pairingData.detectedIps.map((cand) => (
                        <label
                          key={cand.address}
                          className={`flex items-center justify-between p-2 rounded-lg cursor-pointer border transition-colors ${
                            selectedIp === cand.address
                              ? 'bg-indigo-50 dark:bg-indigo-950/60 border-indigo-300 dark:border-indigo-600 text-indigo-900 dark:text-indigo-200 font-medium'
                              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <input
                              type="radio"
                              name="networkIp"
                              value={cand.address}
                              checked={selectedIp === cand.address}
                              onChange={() => handleIpChange(cand.address)}
                              className="text-indigo-600 focus:ring-indigo-500"
                            />
                            <span>{cand.name}</span>
                          </div>
                          <span className="font-mono text-[11px]">{cand.address}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Direct Link Actions */}
            <div className="w-full flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={handleCopyLink}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-xl text-xs font-semibold transition-colors"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" /> : <Copy className="w-4 h-4" />}
                <span>{copied ? 'Link Copied to Clipboard!' : 'Copy Direct Tablet URL'}</span>
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
            </div>
          </div>
        ) : (
          <div className="py-6 text-center text-xs text-rose-500 dark:text-rose-400">
            Failed to generate pairing code. Please try again.
          </div>
        )}

        {/* Troubleshooting Guide */}
        <div className="p-3 bg-amber-50/60 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-800/60 rounded-2xl text-[11px] text-amber-900 dark:text-amber-200 leading-relaxed flex flex-col gap-1">
          <span className="font-semibold text-amber-950 dark:text-amber-100">Taking too long to connect? Check these 3 things:</span>
          <ul className="list-disc pl-4 space-y-0.5 text-amber-800 dark:text-amber-300">
            <li>Ensure the tablet is connected to the exact same Wi-Fi network as the laptop.</li>
            <li>Make sure the development server (<code className="bg-amber-100 dark:bg-amber-900/60 px-1 py-0.5 rounded font-mono">npm run dev:all</code>) is currently running.</li>
            <li>If using a phone mobile hotspot, ensure both laptop and tablet are connected to that hotspot.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
