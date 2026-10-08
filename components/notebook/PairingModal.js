'use client';
import React, { useState, useEffect, useRef } from 'react';
import { useNotebookStore } from '@/lib/store/useNotebookStore';
import {
  QrCode,
  Copy,
  Check,
  X,
  RotateCw,
  ExternalLink
} from 'lucide-react';

// navigator.clipboard is only available on secure origins (https / localhost).
// Tablets on the LAN reach the app over plain http, so fall back to execCommand.
async function copyText(text) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through to legacy path
  }
  try {
    const el = document.createElement('textarea');
    el.value = text;
    el.setAttribute('readonly', '');
    el.style.position = 'fixed';
    el.style.opacity = '0';
    document.body.appendChild(el);
    el.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(el);
    return ok;
  } catch {
    return false;
  }
}

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
      .then(async (res) => {
        const data = await res.json().catch(() => null);
        // An error response has no pairingCode; treat it as a failure instead of rendering "undefined"
        setPairingData(res.ok && data?.pairingCode ? data : null);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to get pairing code:', err);
        setPairingData(null);
        setLoading(false);
      });
  };

  useEffect(() => {
    if (!isOpen || !notebookId) return;
    fetchPairing();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const handleCopyLink = async () => {
    if (!pairingData?.targetUrl) return;
    if (await copyText(pairingData.targetUrl)) {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  const handleCopyCode = async () => {
    if (!pairingData?.pairingCode) return;
    if (await copyText(pairingData.pairingCode)) {
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    }
  };

  return (
    <div onClick={onClose} className="scrim select-none">
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="pairing-title"
        className="index-card sm:max-w-md"
      >
        <div className="index-card-head">
          <div>
            <h2 id="pairing-title" className="index-card-title">Pair a tablet</h2>
            <p className="text-sm text-pencil mt-0.5">Draw on your tablet and it shows up here.</p>
          </div>
          <button type="button" onClick={onClose} className="icon-btn icon-btn-sm -mr-2" title="Close" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="index-card-body flex flex-col gap-5">
          {/* Connection status */}
          <div className="flex items-center gap-2.5 text-sm" aria-live="polite">
            <span className="relative flex w-2.5 h-2.5">
              {tabletConnected && <span className="absolute inset-0 rounded-full bg-ok animate-ping opacity-60" />}
              <span className={`relative w-2.5 h-2.5 rounded-full ${tabletConnected ? 'bg-ok' : 'bg-pencil/50 animate-pulse-subtle'}`} />
            </span>
            {tabletConnected ? (
              <span className="font-semibold text-ok">Tablet connected</span>
            ) : (
              <span className="text-pencil">Waiting for a tablet. Scan the code with its camera.</span>
            )}
          </div>

          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center gap-3">
              <div className="w-7 h-7 border-[3px] border-ballpoint border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-pencil">Creating a pairing code…</p>
            </div>
          ) : pairingData ? (
            <>
              <div className="flex flex-col sm:flex-row items-center gap-5">
                {/* QR always on white paper so phone cameras can read it in dark mode */}
                <div className="p-2.5 bg-white rounded-ctl border border-rule shadow-lift shrink-0">
                  {pairingData.qrCodeDataUrl ? (
                    <img
                      src={pairingData.qrCodeDataUrl}
                      alt="QR code that opens the drawing pad on your tablet"
                      className="w-44 h-44 object-contain"
                    />
                  ) : (
                    <div className="w-44 h-44 flex items-center justify-center text-pencil">
                      <QrCode className="w-14 h-14" />
                    </div>
                  )}
                </div>

                <div className="flex flex-col items-center sm:items-start gap-2 min-w-0">
                  <span className="text-sm text-pencil">Or type this code on the tablet</span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[2.25rem] leading-none font-bold tabular-nums whitespace-nowrap text-ink">
                      {pairingData.pairingCode}
                    </span>
                    <button
                      type="button"
                      onClick={handleCopyCode}
                      title="Copy code"
                      aria-label="Copy code"
                      className="icon-btn"
                    >
                      {copiedCode ? <Check className="w-4 h-4 text-ok" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                  <span className="text-xs text-pencil">Works only while this notebook stays open.</span>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-4 border-t border-rule">
                <button type="button" onClick={handleCopyLink} className="btn btn-outline flex-1">
                  {copiedLink ? <Check className="w-4 h-4 text-ok" /> : <Copy className="w-4 h-4" />}
                  <span>{copiedLink ? 'Link copied' : 'Copy link'}</span>
                </button>
                <a
                  href={pairingData.targetUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="icon-btn border border-rule"
                  title="Open the drawing pad in a new tab"
                  aria-label="Open the drawing pad in a new tab"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
                <button
                  type="button"
                  onClick={fetchPairing}
                  className="icon-btn border border-rule"
                  title="Get a new code"
                  aria-label="Get a new code"
                >
                  <RotateCw className="w-4 h-4" />
                </button>
              </div>
            </>
          ) : (
            <div className="py-6 flex flex-col items-center gap-3 text-center">
              <p className="text-sm text-correction">Couldn’t create a pairing code. Check your connection, then try again.</p>
              <button type="button" onClick={fetchPairing} className="btn btn-outline btn-sm">
                <RotateCw className="w-4 h-4" />
                Try again
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
