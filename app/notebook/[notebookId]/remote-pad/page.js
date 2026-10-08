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
              setErrorMessage("This pairing code has expired or isn't valid. Open the notebook on your computer and make a new one.");
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
            setErrorMessage("Couldn't reach the notebook. Scan the QR code on your computer again.");
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
          setErrorMessage('Scan the QR code shown in the notebook on your computer to use this device as a drawing pad.');
          setLoading(false);
          return;
        }
      } catch (err) {
        console.error('Tablet session init error:', err);
        setErrorMessage("The pad couldn't connect. Check that this device is on the same network, then reload.");
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
      <PadMessage
        title="Pad disconnected"
        body="This device has stopped drawing into the notebook. Nothing from the account was stored here."
        action={
          <button type="button" onClick={() => window.location.reload()} className="btn btn-primary h-11 px-5">
            Reconnect
          </button>
        }
      />
    );
  }

  if (errorMessage) {
    return (
      <PadMessage
        tone="error"
        title="Can't open the drawing pad"
        body={errorMessage}
      />
    );
  }

  if (loading || !notebook || pages.length === 0) {
    return (
      <div className="min-h-[100dvh] w-full flex flex-col items-center justify-center gap-4 bg-desk text-ink p-6" role="status">
        <div className="w-10 h-10 rounded-full border-[3px] border-rule border-t-ballpoint animate-spin" />
        <div className="text-center">
          <p className="text-base font-semibold">Connecting the pad</p>
          <p className="text-sm text-pencil mt-1">Checking the pairing code with your computer</p>
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

function PadMessage({ title, body, action, tone }) {
  return (
    <div
      className="min-h-[100dvh] w-full flex items-center justify-center bg-desk text-ink"
      style={{ padding: 'max(1.5rem, env(safe-area-inset-top)) 1rem max(1.5rem, env(safe-area-inset-bottom))' }}
    >
      <div className="index-card rounded-panel max-w-sm">
        <div className="index-card-head">
          <h1 className={`font-hand text-2xl leading-tight ${tone === 'error' ? 'text-correction' : 'text-ink'}`}>{title}</h1>
        </div>
        <div className="index-card-body space-y-5">
          <p className="text-sm text-pencil leading-relaxed">{body}</p>
          {action}
        </div>
      </div>
    </div>
  );
}
