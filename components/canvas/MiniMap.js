'use client';
import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useNotebookStore } from '@/lib/store/useNotebookStore';
import { Map, Crosshair, ChevronDown, ChevronUp, Tablet, Laptop, Users } from 'lucide-react';

// Mirror the main canvas's ink adaptation so dark ink stays visible on dark paper
function adaptInk(color, darkMode) {
  if (!color) return color;
  if (darkMode && (color === '#0f172a' || color === '#1e293b' || color === '#000000')) return '#f8fafc';
  if (!darkMode && (color === '#f8fafc' || color === '#ffffff')) return '#0f172a';
  return color;
}

export default function MiniMap({
  documentState,
  containerRef,
  zoomOverride,
  panXOverride,
  panYOverride,
  setPanOverride,
  resetViewOverride,
  peersOverride,
  isRemotePad = false
}) {
  const store = useNotebookStore();
  const zoom = zoomOverride ?? store.zoom;
  const panX = panXOverride ?? store.panX;
  const panY = panYOverride ?? store.panY;
  const setPan = setPanOverride ?? store.setPan;
  const resetView = resetViewOverride ?? store.resetView;
  const darkMode = store.darkMode;
  const peers = peersOverride ?? store.peers;
  const tabletConnected = store.tabletConnected;

  const canvasRef = useRef(null);
  const [isExpanded, setIsExpanded] = useState(false); // start collapsed on small/remote devices or toggleable
  const [isDragging, setIsDragging] = useState(false);

  const MAP_WIDTH = 160;
  const MAP_HEIGHT = 110;

  // Redraw minimap when strokes, shapes, pan, zoom, or connected devices change
  const drawMiniMap = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef?.current;
    if (!canvas || !container || !isExpanded) return;

    const ctx = canvas.getContext('2d');
    const containerW = container.clientWidth || 800;
    const containerH = container.clientHeight || 600;

    // Viewport in world coordinates
    const viewWorldLeft = -panX / zoom;
    const viewWorldTop = -panY / zoom;
    const viewWorldRight = (-panX + containerW) / zoom;
    const viewWorldBottom = (-panY + containerH) / zoom;

    // Compute bounding box incorporating standard page bounds, content, camera, and connected devices
    let minX = Math.min(-800, viewWorldLeft - 100);
    let maxX = Math.max(1200, viewWorldRight + 100);
    let minY = Math.min(-600, viewWorldTop - 100);
    let maxY = Math.max(1200, viewWorldBottom + 100);

    // Expand bounding box with strokes
    if (documentState?.strokes) {
      for (const stroke of documentState.strokes) {
        for (const pt of stroke.points || []) {
          if (pt.x < minX) minX = pt.x - 50;
          if (pt.x > maxX) maxX = pt.x + 50;
          if (pt.y < minY) minY = pt.y - 50;
          if (pt.y > maxY) maxY = pt.y + 50;
        }
      }
    }

    // Expand with shapes
    if (documentState?.shapes) {
      for (const shape of documentState.shapes) {
        const sx = Math.min(shape.startX, shape.endX);
        const ex = Math.max(shape.startX, shape.endX);
        const sy = Math.min(shape.startY, shape.endY);
        const ey = Math.max(shape.startY, shape.endY);
        if (sx < minX) minX = sx - 50;
        if (ex > maxX) maxX = ex + 50;
        if (sy < minY) minY = sy - 50;
        if (ey > maxY) maxY = ey + 50;
      }
    }

    // Expand with text blocks
    if (documentState?.textBlocks) {
      for (const tb of documentState.textBlocks) {
        const tw = tb.width || 200;
        if (tb.x < minX) minX = tb.x - 50;
        if (tb.x + tw > maxX) maxX = tb.x + tw + 50;
        if (tb.y < minY) minY = tb.y - 50;
        if (tb.y + 60 > maxY) maxY = tb.y + 100;
      }
    }

    // Expand with connected peers / tablet cursors
    if (Array.isArray(peers)) {
      for (const p of peers) {
        if (p.cursor && typeof p.cursor.x === 'number' && typeof p.cursor.y === 'number') {
          if (p.cursor.x < minX) minX = p.cursor.x - 50;
          if (p.cursor.x > maxX) maxX = p.cursor.x + 50;
          if (p.cursor.y < minY) minY = p.cursor.y - 50;
          if (p.cursor.y > maxY) maxY = p.cursor.y + 50;
        }
      }
    }

    const boundW = Math.max(maxX - minX, 100);
    const boundH = Math.max(maxY - minY, 100);
    const scale = Math.min(MAP_WIDTH / boundW, MAP_HEIGHT / boundH);

    // Coordinate conversion from world to minimap pixels
    const worldToMap = (wx, wy) => ({
      x: (wx - minX) * scale + (MAP_WIDTH - boundW * scale) / 2,
      y: (wy - minY) * scale + (MAP_HEIGHT - boundH * scale) / 2
    });

    ctx.clearRect(0, 0, MAP_WIDTH, MAP_HEIGHT);

    // Background
    ctx.fillStyle = darkMode ? '#222529' : '#FCFCFA';
    ctx.fillRect(0, 0, MAP_WIDTH, MAP_HEIGHT);

    // Render strokes in miniature
    if (documentState?.strokes) {
      for (const stroke of documentState.strokes) {
        const pts = stroke.points;
        if (!pts || pts.length === 0) continue;
        ctx.beginPath();
        const first = worldToMap(pts[0].x, pts[0].y);
        ctx.moveTo(first.x, first.y);
        for (let i = 1; i < pts.length; i++) {
          const m = worldToMap(pts[i].x, pts[i].y);
          ctx.lineTo(m.x, m.y);
        }
        ctx.strokeStyle = adaptInk(stroke.color, darkMode) || (darkMode ? '#E8E9E4' : '#23262A');
        ctx.lineWidth = Math.max(1, (stroke.width || 4) * scale);
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.stroke();
      }
    }

    // Render shapes in miniature
    if (documentState?.shapes) {
      for (const shape of documentState.shapes) {
        const p1 = worldToMap(shape.startX, shape.startY);
        const p2 = worldToMap(shape.endX, shape.endY);
        ctx.strokeStyle = adaptInk(shape.color, darkMode) || (darkMode ? '#92A5FF' : '#2340C8');
        ctx.lineWidth = Math.max(1, (shape.width || 2) * scale);

        if (shape.type === 'rect' || shape.type === 'rectangle') {
          const rx = Math.min(p1.x, p2.x);
          const ry = Math.min(p1.y, p2.y);
          const rw = Math.abs(p2.x - p1.x);
          const rh = Math.abs(p2.y - p1.y);
          ctx.strokeRect(rx, ry, rw, rh);
        } else if (shape.type === 'circle') {
          const cx = (p1.x + p2.x) / 2;
          const cy = (p1.y + p2.y) / 2;
          const r = Math.hypot(p2.x - p1.x, p2.y - p1.y) / 2;
          ctx.beginPath();
          ctx.arc(cx, cy, Math.max(r, 1), 0, Math.PI * 2);
          ctx.stroke();
        } else {
          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.stroke();
        }
      }
    }

    // Render text blocks in miniature
    if (documentState?.textBlocks) {
      for (const tb of documentState.textBlocks) {
        const tp = worldToMap(tb.x, tb.y);
        const tw = Math.max((tb.width || 200) * scale, 6);
        ctx.fillStyle = darkMode ? 'rgba(226, 211, 72, 0.6)' : 'rgba(214, 196, 40, 0.75)';
        ctx.fillRect(tp.x, tp.y, tw, Math.max(4 * scale, 3));
      }
    }

    // Live Camera Viewport Box
    const vpTopLeft = worldToMap(viewWorldLeft, viewWorldTop);
    const vpBottomRight = worldToMap(viewWorldRight, viewWorldBottom);
    const vpW = Math.max(vpBottomRight.x - vpTopLeft.x, 6);
    const vpH = Math.max(vpBottomRight.y - vpTopLeft.y, 6);

    ctx.save();
    ctx.fillStyle = darkMode ? 'rgba(146, 165, 255, 0.14)' : 'rgba(35, 64, 200, 0.1)';
    ctx.fillRect(vpTopLeft.x, vpTopLeft.y, vpW, vpH);
    ctx.strokeStyle = darkMode ? '#92A5FF' : '#2340C8';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(vpTopLeft.x, vpTopLeft.y, vpW, vpH);
    ctx.restore();

    // Render Connected Devices / Peers Live Position
    if (Array.isArray(peers)) {
      for (const p of peers) {
        if (p.cursor && typeof p.cursor.x === 'number' && typeof p.cursor.y === 'number') {
          const cp = worldToMap(p.cursor.x, p.cursor.y);
          const isTabletDevice = p.isTablet;
          const peerColor = isTabletDevice ? '#2F7A52' : '#C2412D';

          ctx.save();
          // Pulsing halo
          ctx.beginPath();
          ctx.arc(cp.x, cp.y, 6, 0, Math.PI * 2);
          ctx.fillStyle = isTabletDevice ? 'rgba(47, 122, 82, 0.3)' : 'rgba(194, 65, 45, 0.3)';
          ctx.fill();

          // Dot marker
          ctx.beginPath();
          ctx.arc(cp.x, cp.y, 3, 0, Math.PI * 2);
          ctx.fillStyle = peerColor;
          ctx.fill();
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1;
          ctx.stroke();

          // Device Tag
          ctx.fillStyle = darkMode ? '#E8E9E4' : '#23262A';
          ctx.font = 'bold 8px system-ui, sans-serif';
          ctx.fillText(isTabletDevice ? 'Tablet' : (p.user?.name?.split(' ')[0] || 'Guest'), cp.x + 5, cp.y + 3);
          ctx.restore();
        }
      }
    }

    // Store coordinate transform bounds on canvas for click/drag mapping
    canvas._miniMapBounds = { minX, minY, boundW, boundH, scale, containerW, containerH };
  }, [documentState, panX, panY, zoom, containerRef, isExpanded, darkMode, peers]);

  useEffect(() => {
    drawMiniMap();
  }, [drawMiniMap]);

  // Handle click or drag on minimap to navigate main canvas
  const handleMapInteraction = (e) => {
    const canvas = canvasRef.current;
    if (!canvas || !canvas._miniMapBounds) return;

    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    const { minX, minY, boundW, boundH, scale, containerW, containerH } = canvas._miniMapBounds;
    const offsetX = (MAP_WIDTH - boundW * scale) / 2;
    const offsetY = (MAP_HEIGHT - boundH * scale) / 2;

    const worldTargetX = minX + (clickX - offsetX) / scale;
    const worldTargetY = minY + (clickY - offsetY) / scale;

    // Center camera at world coordinates
    const newPanX = containerW / 2 - worldTargetX * zoom;
    const newPanY = containerH / 2 - worldTargetY * zoom;

    setPan(Math.round(newPanX), Math.round(newPanY));
  };

  const handlePointerDown = (e) => {
    e.stopPropagation();
    setIsDragging(true);
    handleMapInteraction(e);
  };

  const handlePointerMove = (e) => {
    if (!isDragging) return;
    e.stopPropagation();
    handleMapInteraction(e);
  };

  const handlePointerUp = (e) => {
    if (isDragging) {
      e.stopPropagation();
      setIsDragging(false);
    }
  };

  const activeConnectedCount = (Array.isArray(peers) ? peers.filter(p => p.cursor) : []).length;

  return (
    <div
      onPointerDown={(e) => e.stopPropagation()}
      className={`fixed ${isRemotePad ? 'bottom-24 right-3' : 'right-3 sm:right-5'} z-20 flex flex-col items-end gap-1.5 select-none`}
      style={isRemotePad ? undefined : {
        bottom: 'calc(var(--tray-h, 72px) + env(safe-area-inset-bottom) + 18px)',
        right: 'max(0.75rem, env(safe-area-inset-right))'
      }}
    >
      {/* Expanded map */}
      {isExpanded && (
        <div className="panel p-2 flex flex-col gap-1.5 order-first" style={{ animation: 'card-in 160ms ease-out' }}>
          <div className="flex items-center justify-between px-1 text-xs text-pencil">
            <span>{tabletConnected ? 'Computer and tablet' : 'Page overview'}</span>
            {tabletConnected && (
              <span className="flex items-center gap-1 text-ok font-semibold">
                <span className="w-1.5 h-1.5 rounded-full bg-ok"></span> Live
              </span>
            )}
          </div>

          <div className="relative rounded-[6px] overflow-hidden border border-rule cursor-crosshair">
            <canvas
              ref={canvasRef}
              width={MAP_WIDTH}
              height={MAP_HEIGHT}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerLeave={handlePointerUp}
              className="block max-w-[calc(100vw-3rem)]"
              style={{ width: `${MAP_WIDTH}px`, height: `${MAP_HEIGHT}px` }}
            />
          </div>

          <div className="flex items-center justify-between px-1 text-xs text-pencil">
            <span>Drag to move around</span>
            <button
              type="button"
              onClick={resetView}
              title="Reset to 100%"
              className="flex items-center gap-1 h-7 px-1.5 -mr-1 rounded-[6px] font-semibold text-ink hover:bg-paper-2 transition-colors"
            >
              <Crosshair className="w-3.5 h-3.5" /> Recenter
            </button>
          </div>
        </div>
      )}

      {/* Toggle */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        title={isExpanded ? 'Hide map' : 'Show map'}
        aria-label={isExpanded ? 'Hide map' : 'Show map'}
        aria-expanded={isExpanded}
        className="flex items-center gap-1.5 h-10 px-3 rounded-ctl bg-paper text-ink text-[13px] font-semibold border border-rule shadow-lift hover:bg-paper-2 transition-colors"
      >
        <Map className="w-4 h-4 text-pencil" />
        <span className="hidden sm:inline">Map</span>
        {(tabletConnected || activeConnectedCount > 0) && (
          <span className="w-2 h-2 rounded-full bg-ok" title="Someone else is on this page" />
        )}
        {isExpanded ? <ChevronDown className="w-3.5 h-3.5 text-pencil" /> : <ChevronUp className="w-3.5 h-3.5 text-pencil" />}
      </button>
    </div>
  );
}
