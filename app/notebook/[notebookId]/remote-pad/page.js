'use client';
import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCollabSocket } from '@/lib/collaboration/useCollabSocket';
import { useNotebookStore } from '@/lib/store/useNotebookStore';
import RemotePadCanvas from '@/components/canvas/RemotePadCanvas';

export default function RemotePadPage({ params }) {
  const { notebookId } = params;
  const router = useRouter();
  const searchParams = useSearchParams();
  const pairingCode = searchParams.get('pairing');

  const [notebook, setNotebook] = useState(null);
  const [pages, setPages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState(null);
  const [stylusToken, setStylusToken] = useState(null);
  const [isCanvasOnly, setIsCanvasOnly] = useState(false);
  const [disconnected, setDisconnected] = useState(false);

  useEffect(() => {
    async function initTabletSession() {
      try {
        setLoading(true);
        setErrorMessage(null);

        // 1. Check if the user already has a legitimate authenticated session
        const meRes = await fetch('/api/auth/me');
        const meData = await meRes.json();

        let token = null;

        // 2. If accessing via QR code or PIN pairing code
        if (pairingCode) {
          try {
            const verifyRes = await fetch('/api/pairing/verify', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ code: pairingCode })
            });
            const verifyData = await verifyRes.json();
            if (verifyData.success && verifyData.stylusToken) {
              token = verifyData.stylusToken;
              setStylusToken(token);
              setIsCanvasOnly(true);
              if (typeof window !== 'undefined') {
                sessionStorage.setItem(`stylus_token_${notebookId}`, token);
              }
            } else {
              setErrorMessage('The QR code or pairing PIN has expired or is invalid. Please generate a new code on your PC.');
              setLoading(false);
              return;
            }
          } catch (err) {
            console.error('Pairing verification failed:', err);
          }
        } else if (typeof window !== 'undefined') {
          // Check if we have a saved stylus token in session
          const savedToken = sessionStorage.getItem(`stylus_token_${notebookId}`);
          if (savedToken) {
            token = savedToken;
            setStylusToken(token);
            setIsCanvasOnly(true);
          }
        }

        // 3. Fetch canvas info
        if (token || pairingCode) {
          // Canvas-only paired device: fetch minimal canvas metadata (strictly zero user personal data)
          const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
          const pairQuery = pairingCode ? `&pairing=${encodeURIComponent(pairingCode)}` : '';
          const canvasRes = await fetch(`/api/pairing/canvas-info?notebookId=${notebookId}${pairQuery}`, { headers });
          
          if (!canvasRes.ok) {
            setErrorMessage('Unable to connect to notebook canvas. Please re-scan the QR code.');
            setLoading(false);
            return;
          }

          const canvasData = await canvasRes.json();
          setNotebook(canvasData.notebook);
          setPages(canvasData.pages || []);
          setIsCanvasOnly(true);
        } else if (meData.authenticated) {
          // Authenticated account viewing own notebook
          const res = await fetch(`/api/notebooks/${notebookId}`);
          if (!res.ok) {
            throw new Error('Failed to load notebook');
          }
          const data = await res.json();
          setNotebook(data.notebook);
          setPages(data.pages || []);
          setIsCanvasOnly(false);
        } else {
          setErrorMessage('No pairing code provided. Please scan the QR code from your Desktop PC to use this tablet as a drawing pad.');
          setLoading(false);
          return;
        }
      } catch (err) {
        console.error('Tablet session init error:', err);
        setErrorMessage('Failed to initialize drawing pad. Please check network connection and try again.');
      } finally {
        setLoading(false);
      }
    }

    initTabletSession();
  }, [notebookId, pairingCode]);

  const handleDisconnect = () => {
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem(`stylus_token_${notebookId}`);
    }
    setDisconnected(true);
  };

  if (disconnected) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-slate-950 text-white p-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-400 mb-4 shadow-xl">
          <svg className="w-8 h-8 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>
        <h2 className="text-lg font-bold text-slate-100">Drawing Pad Disconnected</h2>
        <p className="text-sm text-slate-400 max-w-sm mt-2">
          This device was disconnected from the session. For security reasons, no account or user data was shared with this device.
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-6 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md transition-colors"
        >
          Reconnect
        </button>
      </div>
    );
  }

  if (errorMessage) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-slate-950 text-white p-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-rose-950/40 border border-rose-800/60 flex items-center justify-center text-rose-400 mb-4 shadow-xl">
          <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h2 className="text-lg font-bold text-slate-100">Access Restricted</h2>
        <p className="text-sm text-slate-400 max-w-sm mt-2">{errorMessage}</p>
      </div>
    );
  }

  if (loading || !notebook || pages.length === 0) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-slate-950 text-white gap-4">
        <div className="relative">
          <div className="w-12 h-12 border-3 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin"></div>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="w-2.5 h-2.5 bg-indigo-500 rounded-full animate-pulse"></span>
          </div>
        </div>
        <div className="text-center">
          <h2 className="text-sm font-semibold text-slate-200">Connecting Drawing Pad</h2>
          <p className="text-xs text-slate-400 mt-1 font-mono">Verifying secure scoped canvas session...</p>
        </div>
      </div>
    );
  }

  return (
    <RemotePadSession
      notebookId={notebookId}
      notebook={notebook}
      pages={pages}
      isCanvasOnly={isCanvasOnly}
      pairingCode={pairingCode}
      stylusToken={stylusToken}
      onDisconnect={handleDisconnect}
    />
  );
}

function RemotePadSession({
  notebookId,
  notebook,
  pages,
  isCanvasOnly,
  pairingCode,
  stylusToken,
  onDisconnect
}) {
  const router = useRouter();
  const [activePageIndex, setActivePageIndex] = useState(0);
  const activePage = pages[activePageIndex] || pages[0];
  const { syncStatus } = useNotebookStore();

  const {
    documentState,
    sendOp,
    sendCursor
  } = useCollabSocket({
    notebookId,
    pageId: activePage?.id || 'page_overview',
    isTablet: true,
    pairingCode,
    stylusToken
  });

  return (
    <RemotePadCanvas
      documentState={documentState}
      onSendOp={sendOp}
      onSendCursor={sendCursor}
      targetDeviceName="Desktop PC"
      notebookTitle={notebook?.title || 'Notebook'}
      pages={pages}
      activePageIndex={activePageIndex}
      onSelectPage={(idx) => setActivePageIndex(idx)}
      onCreatePage={null}
      syncStatus={syncStatus}
      isCanvasOnly={isCanvasOnly}
      backgroundType={activePage?.background_type || 'dotted'}
      onExit={isCanvasOnly ? onDisconnect : () => router.push(`/notebook/${notebookId}`)}
    />
  );
}
