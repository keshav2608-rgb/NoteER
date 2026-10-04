import { useEffect, useRef, useState, useCallback } from 'react';
import { useNotebookStore } from '../store/useNotebookStore';

function getCollabWsUrl() {
  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const port = window.location.port;

    // 1. If accessing via secure HTTPS or behind standard reverse proxy (port 80/443 or no port)
    if (window.location.protocol === 'https:' || !port || port === '80' || port === '443') {
      return `${protocol}//${host}/collab-ws`;
    }

    // 2. In local dev environment (e.g. Next.js on port 3000), connect to Collab server on port 1234
    // This works both for localhost and across LAN Wi-Fi (e.g. 192.168.x.x:1234)
    if (host) {
      return `${protocol}//${host}:1234`;
    }
  }

  // If explicit external production URL is configured, use it
  const envUrl = process.env.NEXT_PUBLIC_COLLAB_WS_URL;
  if (envUrl && !envUrl.includes('localhost') && !envUrl.includes('127.0.0.1')) {
    return envUrl;
  }

  return 'ws://localhost:1234';
}

export function useCollabSocket({ notebookId, pageId, isTablet = false, pairingCode = null, stylusToken = null, onRemoteOp }) {
  const wsRef = useRef(null);
  const isReadyRef = useRef(false);
  const reconnectTimeoutRef = useRef(null);
  const retryCountRef = useRef(0);
  const isUnmountedRef = useRef(false);
  const pendingOpsQueueRef = useRef([]);

  const [documentState, setDocumentState] = useState({
    strokes: [],
    shapes: [],
    textBlocks: []
  });

  const setSyncStatus = useNotebookStore((s) => s.setSyncStatus);
  const setPeers = useNotebookStore((s) => s.setPeers);
  const setTabletConnected = useNotebookStore((s) => s.setTabletConnected);

  const connect = useCallback(async () => {
    if (!notebookId || !pageId || pageId === 'default' || isUnmountedRef.current) return;

    try {
      setSyncStatus('syncing');

      // Clean up any existing socket before opening a new one
      if (wsRef.current) {
        try {
          const oldWs = wsRef.current;
          wsRef.current = null;
          isReadyRef.current = false;
          oldWs.onopen = null;
          oldWs.onmessage = null;
          oldWs.onclose = null;
          oldWs.onerror = null;
          oldWs.close();
        } catch (_) {}
      }

      // 1. Fetch short-lived collaboration token (with optional scoped stylus credentials)
      const headers = {};
      if (stylusToken) {
        headers['Authorization'] = `Bearer ${stylusToken}`;
      }
      const pairParam = pairingCode ? `&pairing=${encodeURIComponent(pairingCode)}` : '';
      const res = await fetch(`/api/collab/token?notebookId=${notebookId}&pageId=${pageId}${pairParam}`, { headers });
      if (!res.ok) {
        throw new Error('Failed to get collab token');
      }
      const data = await res.json();
      const token = data.token;

      if (isUnmountedRef.current) return;

      // 2. Establish WebSocket connection
      const wsUrl = getCollabWsUrl();
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        retryCountRef.current = 0;
        setSyncStatus('syncing');

        // Send auth handshake
        ws.send(JSON.stringify({
          type: 'auth:join',
          token,
          roomName: `notebook:${notebookId}:page:${pageId}`,
          isTablet
        }));
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);

          if (msg.type === 'auth:success') {
            isReadyRef.current = true;
            setSyncStatus('saved');

            // Flush any operations that were queued while socket was connecting
            while (pendingOpsQueueRef.current.length > 0) {
              const pendingOp = pendingOpsQueueRef.current.shift();
              if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({
                  type: 'sync:op',
                  op: pendingOp
                }));
              }
            }
            return;
          }

          if (msg.type === 'sync:init') {
            isReadyRef.current = true;
            setDocumentState({
              strokes: Array.isArray(msg.documentState?.strokes) ? msg.documentState.strokes : [],
              shapes: Array.isArray(msg.documentState?.shapes) ? msg.documentState.shapes : [],
              textBlocks: Array.isArray(msg.documentState?.textBlocks) ? msg.documentState.textBlocks : []
            });
            if (msg.awareness) {
              const awarenessArr = Array.isArray(msg.awareness) ? msg.awareness : [];
              setPeers(awarenessArr);
              setTabletConnected(awarenessArr.some((p) => p.isTablet));
            }
            setSyncStatus('saved');

            // Flush any operations that were queued while socket was connecting
            while (pendingOpsQueueRef.current.length > 0) {
              const pendingOp = pendingOpsQueueRef.current.shift();
              if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({
                  type: 'sync:op',
                  op: pendingOp
                }));
              }
            }
            return;
          }

          if (msg.type === 'awareness:list') {
            const awarenessArr = Array.isArray(msg.awareness) ? msg.awareness : [];
            setPeers(awarenessArr);
            setTabletConnected(awarenessArr.some((p) => p.isTablet));
            return;
          }

          if (msg.type === 'awareness:update') {
            // Update individual peer cursor
            setPeers((prev) => {
              const currentList = Array.isArray(prev) ? prev : [];
              const idx = currentList.findIndex((p) => p.clientId === msg.clientId);
              if (idx >= 0) {
                const updated = [...currentList];
                updated[idx] = { ...updated[idx], cursor: msg.cursor, isTablet: msg.isTablet };
                return updated;
              }
              return [...currentList, { clientId: msg.clientId, user: msg.user, cursor: msg.cursor, isTablet: msg.isTablet }];
            });
            if (msg.isTablet) {
              setTabletConnected(true);
            }
            return;
          }

          if (msg.type === 'sync:op') {
            // Received remote stroke/shape/text update from peer or tablet
            const op = msg.op;
            setDocumentState((prev) => {
              const strokes = Array.isArray(prev.strokes) ? prev.strokes : [];
              const shapes = Array.isArray(prev.shapes) ? prev.shapes : [];
              const textBlocks = Array.isArray(prev.textBlocks) ? prev.textBlocks : [];

              let updated = { strokes, shapes, textBlocks };

              if (op.type === 'stroke:add' && op.stroke) {
                // Avoid duplicates if op was already added
                if (!updated.strokes.some((s) => s.id === op.stroke.id)) {
                  updated.strokes = [...updated.strokes, op.stroke];
                }
              } else if (op.type === 'stroke:erase' && op.strokeId) {
                updated.strokes = updated.strokes.filter((s) => s.id !== op.strokeId);
              } else if (op.type === 'stroke:clear') {
                updated.strokes = [];
              } else if (op.type === 'shape:add' && op.shape) {
                if (!updated.shapes.some((s) => s.id === op.shape.id)) {
                  updated.shapes = [...updated.shapes, op.shape];
                }
              } else if (op.type === 'shape:update' && op.shape) {
                const sIdx = updated.shapes.findIndex((s) => s.id === op.shape.id);
                if (sIdx >= 0) {
                  updated.shapes[sIdx] = op.shape;
                } else {
                  updated.shapes = [...updated.shapes, op.shape];
                }
              } else if (op.type === 'shape:delete' && op.shapeId) {
                updated.shapes = updated.shapes.filter((s) => s.id !== op.shapeId);
              } else if (op.type === 'text:update' && op.textBlock) {
                const tIdx = updated.textBlocks.findIndex((t) => t.id === op.textBlock.id);
                if (tIdx >= 0) {
                  updated.textBlocks[tIdx] = op.textBlock;
                } else {
                  updated.textBlocks = [...updated.textBlocks, op.textBlock];
                }
              } else if (op.type === 'state:restore' && op.documentState) {
                updated = {
                  strokes: Array.isArray(op.documentState.strokes) ? op.documentState.strokes : [],
                  shapes: Array.isArray(op.documentState.shapes) ? op.documentState.shapes : [],
                  textBlocks: Array.isArray(op.documentState.textBlocks) ? op.documentState.textBlocks : []
                };
              }
              return updated;
            });

            if (onRemoteOp) {
              onRemoteOp(op);
            }
            return;
          }
        } catch (err) {
          console.error('[Collab Client] Message parse error:', err);
        }
      };

      ws.onclose = () => {
        isReadyRef.current = false;
        if (isUnmountedRef.current || wsRef.current !== ws) return;
        setSyncStatus('reconnecting');
        const delay = Math.min(1000 * Math.pow(1.5, retryCountRef.current), 10000);
        retryCountRef.current += 1;
        reconnectTimeoutRef.current = setTimeout(connect, delay);
      };

      ws.onerror = () => {
        if (isUnmountedRef.current || wsRef.current !== ws) return;
        setSyncStatus('offline');
      };

    } catch (err) {
      if (isUnmountedRef.current) return;
      setSyncStatus('offline');
      const delay = Math.min(2000 * Math.pow(1.5, retryCountRef.current), 15000);
      retryCountRef.current += 1;
      reconnectTimeoutRef.current = setTimeout(connect, delay);
    }
  }, [notebookId, pageId, isTablet, pairingCode, stylusToken, setSyncStatus, setPeers, setTabletConnected, onRemoteOp]);

  useEffect(() => {
    isUnmountedRef.current = false;
    connect();

    return () => {
      isUnmountedRef.current = true;
      isReadyRef.current = false;
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (wsRef.current) {
        const oldWs = wsRef.current;
        wsRef.current = null;
        oldWs.onopen = null;
        oldWs.onmessage = null;
        oldWs.onclose = null;
        oldWs.onerror = null;
        try { oldWs.close(); } catch (_) {}
      }
    };
  }, [connect]);

  // Send collaborative operation to room
  const sendOp = useCallback((op) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN && isReadyRef.current) {
      wsRef.current.send(JSON.stringify({
        type: 'sync:op',
        op
      }));
    } else {
      // Buffer outgoing op while connecting / reconnecting so nothing is lost
      pendingOpsQueueRef.current.push(op);
    }

    // Apply optimistically to local document state
    setDocumentState((prev) => {
      const strokes = Array.isArray(prev.strokes) ? prev.strokes : [];
      const shapes = Array.isArray(prev.shapes) ? prev.shapes : [];
      const textBlocks = Array.isArray(prev.textBlocks) ? prev.textBlocks : [];

      let updated = { strokes, shapes, textBlocks };

      if (op.type === 'stroke:add' && op.stroke) {
        if (!updated.strokes.some((s) => s.id === op.stroke.id)) {
          updated.strokes = [...updated.strokes, op.stroke];
        }
      } else if (op.type === 'stroke:erase' && op.strokeId) {
        updated.strokes = updated.strokes.filter((s) => s.id !== op.strokeId);
      } else if (op.type === 'stroke:clear') {
        updated.strokes = [];
      } else if (op.type === 'shape:add' && op.shape) {
        if (!updated.shapes.some((s) => s.id === op.shape.id)) {
          updated.shapes = [...updated.shapes, op.shape];
        }
      } else if (op.type === 'shape:update' && op.shape) {
        const sIdx = updated.shapes.findIndex((s) => s.id === op.shape.id);
        if (sIdx >= 0) {
          updated.shapes[sIdx] = op.shape;
        } else {
          updated.shapes = [...updated.shapes, op.shape];
        }
      } else if (op.type === 'shape:delete' && op.shapeId) {
        updated.shapes = updated.shapes.filter((s) => s.id !== op.shapeId);
      } else if (op.type === 'text:update' && op.textBlock) {
        const tIdx = updated.textBlocks.findIndex((t) => t.id === op.textBlock.id);
        if (tIdx >= 0) {
          updated.textBlocks[tIdx] = op.textBlock;
        } else {
          updated.textBlocks = [...updated.textBlocks, op.textBlock];
        }
      } else if (op.type === 'state:restore' && op.documentState) {
        updated = {
          strokes: Array.isArray(op.documentState.strokes) ? op.documentState.strokes : [],
          shapes: Array.isArray(op.documentState.shapes) ? op.documentState.shapes : [],
          textBlocks: Array.isArray(op.documentState.textBlocks) ? op.documentState.textBlocks : []
        };
      }
      return updated;
    });
  }, []);

  // Send ephemeral cursor
  const lastCursorSendRef = useRef(0);
  const sendCursor = useCallback((worldX, worldY) => {
    const now = Date.now();
    if (now - lastCursorSendRef.current < 35) return; // throttle to ~30fps
    lastCursorSendRef.current = now;

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN && isReadyRef.current) {
      wsRef.current.send(JSON.stringify({
        type: 'awareness:update',
        cursor: { x: Math.round(worldX), y: Math.round(worldY) }
      }));
    }
  }, []);

  return {
    documentState,
    setDocumentState,
    sendOp,
    sendCursor
  };
}
