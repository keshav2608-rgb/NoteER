'use client';
import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useNotebookStore } from '@/lib/store/useNotebookStore';
import { Map, Crosshair, ChevronDown, ChevronUp, Tablet, Laptop, Users } from 'lucide-react';

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
    ctx.fillStyle = darkMode ? '#0f172a' : '#f8fafc';
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
        ctx.strokeStyle = stroke.color || (darkMode ? '#94a3b8' : '#475569');
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
        ctx.strokeStyle = shape.color || (darkMode ? '#38bdf8' : '#2563eb');
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

    // Live Camera Viewport Box
    const vpTopLeft = worldToMap(viewWorldLeft, viewWorldTop);
    const vpBottomRight = worldToMap(viewWorldRight, viewWorldBottom);
    const vpW = Math.max(vpBottomRight.x - vpTopLeft.x, 6);
    const vpH = Math.max(vpBottomRight.y - vpTopLeft.y, 6);

    ctx.save();
    ctx.fillStyle = darkMode ? 'rgba(99, 102, 241, 0.15)' : 'rgba(99, 102, 241, 0.2)';
    ctx.fillRect(vpTopLeft.x, vpTopLeft.y, vpW, vpH);
    ctx.strokeStyle = darkMode ? '#818cf8' : '#4f46e5';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(vpTopLeft.x, vpTopLeft.y, vpW, vpH);
    ctx.restore();

    // Render Connected Devices / Peers Live Position
    if (Array.isArray(peers)) {
      for (const p of peers) {
        if (p.cursor && typeof p.cursor.x === 'number' && typeof p.cursor.y === 'number') {
          const cp = worldToMap(p.cursor.x, p.cursor.y);
          const isTabletDevice = p.isTablet;
          const peerColor = isTabletDevice ? '#10b981' : '#3b82f6';

          ctx.save();
          // Pulsing halo
          ctx.beginPath();
          ctx.arc(cp.x, cp.y, 6, 0, Math.PI * 2);
          ctx.fillStyle = isTabletDevice ? 'rgba(16, 185, 129, 0.3)' : 'rgba(59, 130, 246, 0.3)';
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
          ctx.fillStyle = darkMode ? '#ffffff' : '#0f172a';
          ctx.font = 'bold 8px system-ui, sans-serif';
          ctx.fillText(isTabletDevice ? '📱 Tablet' : (p.user?.name || '💻 Peer'), cp.x + 5, cp.y + 3);
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
      className={`fixed ${isRemotePad ? 'bottom-24 right-3' : 'bottom-20 right-4'} z-20 flex flex-col items-end gap-1.5 select-none`}
    >
      {/* Floating Toggle Button */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        title={isExpanded ? 'Collapse Minimap' : 'Show Minimap'}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-white/90 dark:bg-slate-900/90 hover:bg-white dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold shadow-lg border border-slate-200/80 dark:border-slate-800 backdrop-blur-md transition-all active:scale-95"
      >
        <Map className="w-3.5 h-3.5 text-indigo-500" />
        <span className="hidden sm:inline">Minimap</span>
        {(tabletConnected || activeConnectedCount > 0) && (
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" title="Connected device active" />
        )}
        {isExpanded ? <ChevronDown className="w-3 h-3 opacity-60" /> : <ChevronUp className="w-3 h-3 opacity-60" />}
      </button>

      {/* Expanded Minimap Viewport Card */}
      {isExpanded && (
        <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-md rounded-2xl shadow-2xl border border-slate-200/90 dark:border-slate-800 p-2 animate-in fade-in zoom-in-95 flex flex-col gap-1.5">
          {/* Header indicator showing connected devices */}
          <div className="flex items-center justify-between px-1 text-[10px] text-slate-500 dark:text-slate-400 font-medium">
            <span className="flex items-center gap-1">
              <Users className="w-3 h-3 text-indigo-500" />
              {tabletConnected ? 'PC + Tablet Paired' : 'Canvas Map'}
            </span>
            {tabletConnected && (
              <span className="text-emerald-500 font-semibold flex items-center gap-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Live
              </span>
            )}
          </div>

          <div className="relative rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 cursor-crosshair">
            <canvas
              ref={canvasRef}
              width={MAP_WIDTH}
              height={MAP_HEIGHT}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerLeave={handlePointerUp}
              className="block"
              style={{ width: `${MAP_WIDTH}px`, height: `${MAP_HEIGHT}px` }}
            />
          </div>

          <div className="flex items-center justify-between px-1 text-[10px] text-slate-500 dark:text-slate-400">
            <span>Click / drag to pan</span>
            <button
              type="button"
              onClick={resetView}
              title="Reset View to 100%"
              className="hover:text-indigo-600 dark:hover:text-indigo-400 flex items-center gap-0.5 font-medium transition-colors"
            >
              <Crosshair className="w-2.5 h-2.5" /> Center
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
