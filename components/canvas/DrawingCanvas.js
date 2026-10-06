'use client';
import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useNotebookStore } from '@/lib/store/useNotebookStore';
import {
  screenToWorld,
  worldToScreen,
  renderStroke,
  renderShape,
  simplifyPoints,
  hitTestStroke,
  hitTestShape
} from '@/lib/drawing/engine';
import LiveCursorOverlay from '../collaboration/LiveCursorOverlay';
import StickyTextBlock from '../editor/StickyTextBlock';
import MiniMap from './MiniMap';
import { Type } from 'lucide-react';

export default function DrawingCanvas({
  documentState,
  onSendOp,
  onSendCursor,
  backgroundType = 'dotted',
  readOnly = false
}) {
  const containerRef = useRef(null);
  const mainCanvasRef = useRef(null);
  const draftCanvasRef = useRef(null);

  const {
    tool,
    setTool,
    color,
    strokeWidth,
    opacity,
    fillColor,
    zoom,
    panX,
    panY,
    setZoom,
    setPan,
    pushUndo,
    canEdit,
    darkMode
  } = useNotebookStore();

  const isDrawingRef = useRef(false);
  const currentPointsRef = useRef([]);
  const shapeStartRef = useRef(null);
  const panStartRef = useRef(null);
  const spacePressedRef = useRef(false);
  const newlyCreatedBlockIdRef = useRef(null);

  // Handle keyboard shortcuts (Space for pan, V for select, P for pen, T for text, etc.)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName !== 'TEXTAREA' && e.target.tagName !== 'INPUT') {
        if (e.code === 'Space' && !spacePressedRef.current) {
          spacePressedRef.current = true;
        }
        if (e.key === 'Escape') {
          setTool('select');
        } else if (e.key.toLowerCase() === 'v' || e.key.toLowerCase() === 's') {
          setTool('select');
        } else if (e.key.toLowerCase() === 'p' || e.key.toLowerCase() === 'd') {
          setTool('pen');
        } else if (e.key.toLowerCase() === 't') {
          setTool('text');
        } else if (e.key.toLowerCase() === 'e') {
          setTool('eraser');
        } else if (e.key.toLowerCase() === 'h') {
          setTool('pan');
        }
      }
    };
    const handleKeyUp = (e) => {
      if (e.code === 'Space') {
        spacePressedRef.current = false;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [tool, setTool]);

  const lastSizeRef = useRef({ width: 0, height: 0, dpr: 1 });

  // Redraw persistent document state (all strokes and shapes)
  const drawMainCanvas = useCallback(() => {
    const canvas = mainCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const width = canvas.width / dpr;
    const height = canvas.height / dpr;

    // Always reset to a clean DPR-scaled transform so this function is self-contained
    // regardless of what ctx.scale() calls happened before (e.g. from resizeCanvas)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    // Render background paper pattern in world space
    drawBackgroundPattern(ctx, width, height, backgroundType, zoom, panX, panY);

    // Apply viewport transform (Pan and Zoom)
    ctx.save();
    ctx.translate(panX, panY);
    ctx.scale(zoom, zoom);

    // Render shapes first
    if (documentState.shapes) {
      for (const shape of documentState.shapes) {
        if (darkMode && (shape.color === '#0f172a' || shape.color === '#1e293b' || shape.color === '#000000')) {
          renderShape(ctx, { ...shape, color: '#f8fafc' });
        } else if (!darkMode && (shape.color === '#f8fafc' || shape.color === '#ffffff')) {
          renderShape(ctx, { ...shape, color: '#0f172a' });
        } else {
          renderShape(ctx, shape);
        }
      }
    }

    // Render strokes with contrast adaptation for Dark Mode
    if (documentState.strokes) {
      for (const stroke of documentState.strokes) {
        if (darkMode && (stroke.color === '#0f172a' || stroke.color === '#1e293b' || stroke.color === '#000000')) {
          renderStroke(ctx, { ...stroke, color: '#f8fafc' });
        } else if (!darkMode && (stroke.color === '#f8fafc' || stroke.color === '#ffffff')) {
          renderStroke(ctx, { ...stroke, color: '#0f172a' });
        } else {
          renderStroke(ctx, stroke);
        }
      }
    }

    ctx.restore();

    // Ensure draft canvas is clean when persistent document state is redrawn
    const draftCanvas = draftCanvasRef.current;
    if (draftCanvas) {
      const dCtx = draftCanvas.getContext('2d');
      dCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
      dCtx.clearRect(0, 0, width, height);
    }
  }, [documentState, zoom, panX, panY, backgroundType, darkMode]);

  // Resize canvas buffers to match window/container with devicePixelRatio
  const resizeCanvas = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    const width = container.clientWidth;
    const height = container.clientHeight;
    const dpr = window.devicePixelRatio || 1;

    if (
      lastSizeRef.current.width !== width ||
      lastSizeRef.current.height !== height ||
      lastSizeRef.current.dpr !== dpr
    ) {
      lastSizeRef.current = { width, height, dpr };

      [mainCanvasRef.current, draftCanvasRef.current].forEach((canvas) => {
        if (canvas) {
          canvas.width = width * dpr;
          canvas.height = height * dpr;
          canvas.style.width = `${width}px`;
          canvas.style.height = `${height}px`;
          // Use setTransform instead of scale() to avoid accumulation on repeated calls
          const ctx = canvas.getContext('2d');
          ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        }
      });
    }

    drawMainCanvas();
  }, [drawMainCanvas]);

  useEffect(() => {
    resizeCanvas();
    const container = containerRef.current;
    if (container && typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(() => {
        resizeCanvas();
      });
      observer.observe(container);
      return () => observer.disconnect();
    } else {
      window.addEventListener('resize', resizeCanvas);
      return () => window.removeEventListener('resize', resizeCanvas);
    }
  }, [resizeCanvas]);

  useEffect(() => {
    drawMainCanvas();
  }, [drawMainCanvas]);

  // Helper to draw notebook page grid/dots/ruled
  function drawBackgroundPattern(ctx, width, height, type, z, px, py) {
    ctx.save();
    ctx.fillStyle = darkMode ? '#0f172a' : '#ffffff';
    ctx.fillRect(0, 0, width, height);

    const paperType = type || 'dotted';
    if (paperType === 'blank') {
      ctx.restore();
      return;
    }

    const gridSize = 28 * z;
    const offsetX = ((px % gridSize) + gridSize) % gridSize;
    const offsetY = ((py % gridSize) + gridSize) % gridSize;

    if (paperType === 'dotted') {
      ctx.fillStyle = darkMode ? '#64748b' : '#64748b';
      const dotRadius = Math.max(1.5, 1.8 * Math.min(z, 1.5));
      for (let x = offsetX; x < width; x += gridSize) {
        for (let y = offsetY; y < height; y += gridSize) {
          ctx.beginPath();
          ctx.arc(x, y, dotRadius, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    } else if (paperType === 'grid') {
      ctx.strokeStyle = darkMode ? '#475569' : '#94a3b8';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = offsetX; x < width; x += gridSize) {
        const lineX = Math.floor(x) + 0.5;
        ctx.moveTo(lineX, 0);
        ctx.lineTo(lineX, height);
      }
      for (let y = offsetY; y < height; y += gridSize) {
        const lineY = Math.floor(y) + 0.5;
        ctx.moveTo(0, lineY);
        ctx.lineTo(width, lineY);
      }
      ctx.stroke();
    } else if (paperType === 'ruled') {
      const lineSpacing = 32 * z;
      const offY = ((py % lineSpacing) + lineSpacing) % lineSpacing;
      ctx.strokeStyle = darkMode ? '#475569' : '#94a3b8';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let y = offY; y < height; y += lineSpacing) {
        const lineY = Math.floor(y) + 0.5;
        ctx.moveTo(0, lineY);
        ctx.lineTo(width, lineY);
      }
      ctx.stroke();

      // Classic left margin guideline on notebook ruled paper
      const marginWorldX = 80;
      const marginScreenX = marginWorldX * z + px;
      if (marginScreenX >= 0 && marginScreenX <= width) {
        ctx.beginPath();
        ctx.strokeStyle = darkMode ? '#f43f5e99' : '#e11d4899';
        ctx.lineWidth = 2;
        const lineMarginX = Math.floor(marginScreenX) + 0.5;
        ctx.moveTo(lineMarginX, 0);
        ctx.lineTo(lineMarginX, height);
        ctx.stroke();
      }
    }

    ctx.restore();
  }

  const activePointersRef = useRef(new Map());
  const pinchStartRef = useRef(null);
  const zoomRef = useRef(zoom);
  const panRef = useRef({ x: panX, y: panY });
  const strokeWidthRef = useRef(strokeWidth);
  zoomRef.current = zoom;
  panRef.current = { x: panX, y: panY };
  strokeWidthRef.current = strokeWidth;

  // Non-passive wheel listener for smooth zoom & pan without console passive listener warnings
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheelListener = (e) => {
      if (e.cancelable) {
        e.preventDefault();
      }
      if (e.ctrlKey || e.metaKey) {
        // Zoom anchored at mouse position
        const rect = container.getBoundingClientRect();
        const screenX = e.clientX - rect.left;
        const screenY = e.clientY - rect.top;
        const currentZ = zoomRef.current;
        const currentPan = panRef.current;

        const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
        const newZoom = Math.min(Math.max(currentZ * zoomFactor, 0.25), 4.0);

        if (newZoom !== currentZ) {
          const worldX = (screenX - currentPan.x) / currentZ;
          const worldY = (screenY - currentPan.y) / currentZ;
          const newPanX = screenX - worldX * newZoom;
          const newPanY = screenY - worldY * newZoom;
          setPan(newPanX, newPanY);
          setZoom(newZoom);
        }
      } else {
        // Pan
        setPan(panRef.current.x - e.deltaX, panRef.current.y - e.deltaY);
      }
    };

    container.addEventListener('wheel', handleWheelListener, { passive: false });
    return () => {
      container.removeEventListener('wheel', handleWheelListener);
    };
  }, [setZoom, setPan]);

  // Pointer Down
  const handlePointerDown = (e) => {
    const container = containerRef.current;
    if (!container) return;

    // If the pointer went down on a StickyTextBlock element (textarea, its wrapper, or controls),
    // let that element handle it completely — don't intercept it here.
    // StickyTextBlock's own stopPropagation will prevent canvas interaction.
    const isOnTextBlock = e.target.closest?.('[data-text-block]');
    if (isOnTextBlock) return;

    const rect = container.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;

    activePointersRef.current.set(e.pointerId, { x: screenX, y: screenY });

    // Multi-touch pinch zoom & two-finger pan
    if (activePointersRef.current.size === 2) {
      isDrawingRef.current = false;
      currentPointsRef.current = [];
      shapeStartRef.current = null;
      panStartRef.current = null;

      const draftCanvas = draftCanvasRef.current;
      if (draftCanvas) {
        const ctx = draftCanvas.getContext('2d');
        ctx.clearRect(0, 0, draftCanvas.width, draftCanvas.height);
      }

      const pts = Array.from(activePointersRef.current.values());
      const dist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
      pinchStartRef.current = {
        distance: dist,
        initialZoom: zoomRef.current,
        initialPan: { ...panRef.current },
        midX: (pts[0].x + pts[1].x) / 2,
        midY: (pts[0].y + pts[1].y) / 2
      };
      return;
    }

    if (activePointersRef.current.size > 2) return;

    // Capture pointer so drawing continues smoothly even if cursor briefly exits container.
    // Do NOT capture in select/text mode — text blocks need to receive their own events.
    if (tool !== 'select' && tool !== 'text') {
      try {
        e.target.setPointerCapture?.(e.pointerId);
      } catch (_) {}
    }

    const world = screenToWorld(screenX, screenY, zoom, panX, panY);

    // Pan mode or spacebar pressed
    if (tool === 'pan' || spacePressedRef.current || e.button === 1) {
      panStartRef.current = { mouseX: e.clientX, mouseY: e.clientY, initialPanX: panX, initialPanY: panY };
      return;
    }

    if (readOnly || !canEdit) return;

    // Select mode: standard pointer to select, move, or pan without drawing ink strokes
    if (tool === 'select') {
      panStartRef.current = { mouseX: e.clientX, mouseY: e.clientY, initialPanX: panX, initialPanY: panY };
      return;
    }

    // Text note creation directly on canvas
    if (tool === 'text') {
      try {
        e.preventDefault();
      } catch (_) {}

      // If an empty text block already exists, relocate it to the new click position
      const existingEmptyBlock = documentState.textBlocks?.find(
        (b) => !b.text || !b.text.trim()
      );
      if (existingEmptyBlock) {
        newlyCreatedBlockIdRef.current = existingEmptyBlock.id;
        onSendOp({
          type: 'text:update',
          textBlock: {
            ...existingEmptyBlock,
            x: Math.round(world.x),
            y: Math.round(world.y)
          }
        });
        return;
      }

      const textColor = darkMode ? '#f8fafc' : (color === '#ffffff' || color === '#f8fafc' ? '#0f172a' : color || '#0f172a');
      const newBlock = {
        id: 'txt_' + Math.random().toString(36).substring(2, 10),
        x: Math.round(world.x),
        y: Math.round(world.y),
        width: 320,
        text: '',
        color: textColor,
        style: 'yellow',
        fontSize: 18
      };
      newlyCreatedBlockIdRef.current = newBlock.id;
      pushUndo({ type: 'text:delete', textBlockId: newBlock.id, textBlock: newBlock });
      onSendOp({ type: 'text:update', textBlock: newBlock });
      // Switch back to select tool so clicking outside does not spawn more empty notes
      setTool('select');
      return;
    }

    isDrawingRef.current = true;

    // Eraser mode
    if (tool === 'eraser') {
      handleEraserAt(world.x, world.y);
      return;
    }

    // Shape drawing mode
    if (['rect', 'rectangle', 'circle', 'line', 'arrow'].includes(tool)) {
      shapeStartRef.current = { x: world.x, y: world.y };
      return;
    }

    // Freehand drawing (pen, pencil, highlighter)
    currentPointsRef.current = [{
      x: world.x,
      y: world.y,
      pressure: e.pressure || 0.5
    }];
  };

  // Pointer Move
  const handlePointerMove = (e) => {
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;

    if (activePointersRef.current.has(e.pointerId)) {
      activePointersRef.current.set(e.pointerId, { x: screenX, y: screenY });
    }

    // Handle 2-finger pinch zoom & pan anchored at pinch midpoint
    if (activePointersRef.current.size === 2 && pinchStartRef.current) {
      const pts = Array.from(activePointersRef.current.values());
      const newDist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
      const ratio = newDist / (pinchStartRef.current.distance || 1);
      const newZoom = Math.min(Math.max(Number((pinchStartRef.current.initialZoom * ratio).toFixed(2)), 0.25), 4.0);

      const newMidX = (pts[0].x + pts[1].x) / 2;
      const newMidY = (pts[0].y + pts[1].y) / 2;

      // Focal world point anchored at midpoint
      const worldMidX = (pinchStartRef.current.midX - pinchStartRef.current.initialPan.x) / pinchStartRef.current.initialZoom;
      const worldMidY = (pinchStartRef.current.midY - pinchStartRef.current.initialPan.y) / pinchStartRef.current.initialZoom;

      const newPanX = newMidX - worldMidX * newZoom;
      const newPanY = newMidY - worldMidY * newZoom;

      setZoom(newZoom);
      setPan(newPanX, newPanY);
      return;
    }

    const world = screenToWorld(screenX, screenY, zoom, panX, panY);

    // Send throttled cursor to peers
    onSendCursor(world.x, world.y);

    // Pan dragging
    if (panStartRef.current) {
      const dx = e.clientX - panStartRef.current.mouseX;
      const dy = e.clientY - panStartRef.current.mouseY;
      setPan(panStartRef.current.initialPanX + dx, panStartRef.current.initialPanY + dy);
      return;
    }

    if (!isDrawingRef.current) return;

    // Eraser dragging
    if (tool === 'eraser') {
      handleEraserAt(world.x, world.y);
      return;
    }

    // Shape draft rendering
    if (shapeStartRef.current) {
      renderShapeDraft(shapeStartRef.current, world);
      return;
    }

    // Freehand stroke draft rendering
    currentPointsRef.current.push({
      x: world.x,
      y: world.y,
      pressure: e.pressure || 0.5
    });
    renderStrokeDraft();
  };

  // Pointer Up
  const handlePointerUp = (e) => {
    if (e && e.pointerId) {
      activePointersRef.current.delete(e.pointerId);
      try {
        e.target?.releasePointerCapture?.(e.pointerId);
      } catch (_) {}
    }
    if (activePointersRef.current.size < 2) {
      pinchStartRef.current = null;
    }

    if (panStartRef.current) {
      panStartRef.current = null;
      return;
    }

    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;

    // Clear draft canvas
    const draftCanvas = draftCanvasRef.current;
    if (draftCanvas) {
      const ctx = draftCanvas.getContext('2d');
      ctx.clearRect(0, 0, draftCanvas.width, draftCanvas.height);
    }

    // Commit shape
    if (shapeStartRef.current) {
      const container = containerRef.current;
      const rect = container.getBoundingClientRect();
      const world = screenToWorld(e.clientX - rect.left, e.clientY - rect.top, zoom, panX, panY);

      const dx = Math.abs(world.x - shapeStartRef.current.x);
      const dy = Math.abs(world.y - shapeStartRef.current.y);
      if (dx > 4 || dy > 4) {
        const currentWidth = Number(strokeWidthRef.current) || 3;
        const shape = {
          id: 'shp_' + Math.random().toString(36).substring(2, 10),
          type: tool,
          startX: shapeStartRef.current.x,
          startY: shapeStartRef.current.y,
          endX: world.x,
          endY: world.y,
          color,
          width: currentWidth,
          opacity,
          fillColor
        };
        pushUndo({ type: 'shape:delete', shapeId: shape.id, shape });
        onSendOp({ type: 'shape:add', shape });
      }
      shapeStartRef.current = null;
      return;
    }

    // Commit freehand stroke
    if (currentPointsRef.current.length > 0) {
      const simplified = simplifyPoints(currentPointsRef.current, 1.2);
      const isHighlighter = tool === 'highlighter';
      const currentWidth = Number(strokeWidthRef.current) || 4;
      const effectiveWidth = isHighlighter ? Math.max(currentWidth * 2, 16) : currentWidth;
      const effectiveOpacity = isHighlighter ? 0.35 : opacity;

      const stroke = {
        id: 'strk_' + Math.random().toString(36).substring(2, 10),
        tool,
        points: simplified,
        color,
        width: effectiveWidth,
        opacity: effectiveOpacity
      };
      currentPointsRef.current = [];
      pushUndo({ type: 'stroke:erase', strokeId: stroke.id, stroke });
      onSendOp({ type: 'stroke:add', stroke });
    }
  };

  // Render draft freehand stroke to top overlay canvas
  const renderStrokeDraft = () => {
    const draftCanvas = draftCanvasRef.current;
    if (!draftCanvas) return;
    const ctx = draftCanvas.getContext('2d');
    const width = draftCanvas.width / (window.devicePixelRatio || 1);
    const height = draftCanvas.height / (window.devicePixelRatio || 1);

    ctx.clearRect(0, 0, width, height);

    ctx.save();
    ctx.translate(panX, panY);
    ctx.scale(zoom, zoom);

    const isHighlighter = tool === 'highlighter';
    const currentWidth = Number(strokeWidthRef.current) || 4;
    const effectiveWidth = isHighlighter ? Math.max(currentWidth * 2, 16) : currentWidth;
    const effectiveOpacity = isHighlighter ? 0.35 : opacity;

    renderStroke(ctx, {
      tool,
      points: currentPointsRef.current,
      color,
      width: effectiveWidth,
      opacity: effectiveOpacity
    });

    ctx.restore();
  };

  // Render draft shape to top overlay canvas
  const renderShapeDraft = (start, current) => {
    const draftCanvas = draftCanvasRef.current;
    if (!draftCanvas) return;
    const ctx = draftCanvas.getContext('2d');
    const width = draftCanvas.width / (window.devicePixelRatio || 1);
    const height = draftCanvas.height / (window.devicePixelRatio || 1);

    ctx.clearRect(0, 0, width, height);

    ctx.save();
    ctx.translate(panX, panY);
    ctx.scale(zoom, zoom);

    renderShape(ctx, {
      type: tool,
      startX: start.x,
      startY: start.y,
      endX: current.x,
      endY: current.y,
      color,
      width: Number(strokeWidthRef.current) || 3,
      opacity,
      fillColor
    });

    ctx.restore();
  };

  // Eraser collision check with zoom compensation
  const handleEraserAt = (worldX, worldY) => {
    const hitThreshold = 18 / zoom;

    // Check strokes
    if (documentState.strokes) {
      for (const stroke of documentState.strokes) {
        if (hitTestStroke(stroke, worldX, worldY, hitThreshold)) {
          pushUndo({ type: 'stroke:add', stroke });
          onSendOp({ type: 'stroke:erase', strokeId: stroke.id });
          return;
        }
      }
    }

    // Check shapes
    if (documentState.shapes) {
      for (const shape of documentState.shapes) {
        if (hitTestShape(shape, worldX, worldY)) {
          pushUndo({ type: 'shape:add', shape });
          onSendOp({ type: 'shape:delete', shapeId: shape.id });
          return;
        }
      }
    }

    // Check text blocks
    if (documentState.textBlocks) {
      for (const block of documentState.textBlocks) {
        const blockW = block.width || 320;
        const blockH = Math.max(36, ((block.text || '').split('\n').length + 1) * (block.fontSize || 18) * 1.5);
        if (
          worldX >= block.x - 10 &&
          worldX <= block.x + blockW + 10 &&
          worldY >= block.y - 10 &&
          worldY <= block.y + blockH + 10
        ) {
          pushUndo({ type: 'text:update', textBlock: block });
          onSendOp({
            type: 'text:delete',
            textBlockId: block.id,
            textBlock: { id: block.id, deleted: true }
          });
          return;
        }
      }
    }
  };

  const getToolCursorStyle = () => {
    if (tool === 'select') {
      return { cursor: 'default' };
    }
    if (tool === 'pan' || spacePressedRef.current) {
      return { cursor: 'grab' };
    }
    if (tool === 'text') {
      return { cursor: 'text' };
    }
    if (tool === 'pen' || tool === 'pencil' || tool === 'highlighter') {
      return { cursor: 'crosshair' };
    }
    if (tool === 'eraser') {
      return { cursor: 'crosshair' };
    }
    if (['rect', 'rectangle', 'circle', 'line', 'arrow'].includes(tool)) {
      return { cursor: 'crosshair' };
    }
    return { cursor: 'default' };
  };

  return (
    <div
      ref={containerRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
      onPointerCancel={handlePointerUp}
      style={getToolCursorStyle()}
      className="relative w-full h-full overflow-hidden select-none touch-none"
    >
      {/* Base Canvas: Background paper & committed strokes */}
      <canvas ref={mainCanvasRef} className="absolute inset-0 pointer-events-none" />

      {/* Draft Canvas: Active drawing stroke in progress */}
      <canvas ref={draftCanvasRef} className="absolute inset-0 pointer-events-none" />

      {/* World-space Canvas Viewport Layer: Transforms all in-canvas HTML elements in 100% exact sync with 2D canvas */}
      <div
        className="absolute inset-0 pointer-events-none origin-top-left overflow-visible z-10"
        style={{
          transform: `translate3d(${panX}px, ${panY}px, 0) scale(${zoom})`,
          transformOrigin: '0 0'
        }}
      >
        {documentState.textBlocks?.map((block) => (
          <StickyTextBlock
            key={block.id}
            block={block}
            zoom={zoom}
            panX={panX}
            panY={panY}
            autoFocus={block.id === newlyCreatedBlockIdRef.current}
            onUpdate={(updated) => onSendOp({ type: 'text:update', textBlock: updated })}
            onDelete={(id) => onSendOp({
              type: 'text:delete',
              textBlockId: id,
              textBlock: { id, deleted: true }
            })}
          />
        ))}
      </div>

      {/* Remote Users Live Cursors */}
      <LiveCursorOverlay />

      {/* Type Mode Helper Banner */}
      {tool === 'text' && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white rounded-full shadow-lg text-xs font-medium animate-pulse">
          <Type size={14} />
          <span>Type Mode: Click anywhere on canvas to write a note</span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setTool('pen');
            }}
            className="ml-2 px-2 py-0.5 bg-white/20 hover:bg-white/30 rounded text-[11px] font-semibold"
          >
            Switch to Draw (Esc)
          </button>
        </div>
      )}

      {/* Interactive Canvas MiniMap */}
      <MiniMap documentState={documentState} containerRef={containerRef} />
    </div>
  );
}
