'use client';
import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  screenToWorld,
  worldToScreen,
  renderStroke,
  renderShape,
  simplifyPoints,
  hitTestStroke,
  hitTestShape
} from '@/lib/drawing/engine';
import MiniMap from './MiniMap';
import StickyTextBlock from '../editor/StickyTextBlock';
import {
  Pen,
  Pencil,
  Highlighter,
  Eraser,
  Square,
  Circle,
  Minus,
  MoveRight,
  Type,
  Hand,
  Maximize2,
  Minimize2,
  RotateCcw,
  Undo2,
  Redo2,
  Trash2,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Laptop,
  Wifi,
  WifiOff,
  Check,
  CheckCircle2,
  Sliders,
  Palette,
  Tablet,
  Plus,
  ArrowLeft,
  Grid,
  Layers,
  Sun,
  Moon,
  Lock,
  Power
} from 'lucide-react';

const LIGHT_PAD_COLORS = [
  { name: 'Obsidian', hex: '#0f172a' },
  { name: 'Slate', hex: '#475569' },
  { name: 'Royal Blue', hex: '#2563eb' },
  { name: 'Indigo', hex: '#4f46e5' },
  { name: 'Emerald', hex: '#059669' },
  { name: 'Amber', hex: '#d97706' },
  { name: 'Crimson', hex: '#dc2626' },
  { name: 'Purple', hex: '#9333ea' }
];

const DARK_PAD_COLORS = [
  { name: 'Pure White', hex: '#f8fafc' },
  { name: 'Bright Yellow', hex: '#facc15' },
  { name: 'Neon Sky', hex: '#38bdf8' },
  { name: 'Mint Emerald', hex: '#34d399' },
  { name: 'Coral Pink', hex: '#fb7185' },
  { name: 'Lilac Purple', hex: '#c084fc' },
  { name: 'Vibrant Orange', hex: '#fb923c' },
  { name: 'Muted Slate', hex: '#94a3b8' }
];

const STROKE_WIDTH_PRESETS = [
  { label: 'Fine', value: 2 },
  { label: 'Medium', value: 4 },
  { label: 'Bold', value: 8 },
  { label: 'Marker', value: 16 }
];

const SHAPE_TOOLS = [
  { id: 'rect', label: 'Rectangle', icon: Square },
  { id: 'circle', label: 'Circle', icon: Circle },
  { id: 'line', label: 'Line', icon: Minus },
  { id: 'arrow', label: 'Arrow', icon: MoveRight }
];

const BACKGROUND_TYPES = [
  { id: 'dotted', label: 'Dotted' },
  { id: 'grid', label: 'Grid' },
  { id: 'ruled', label: 'Ruled' },
  { id: 'blank', label: 'Blank' }
];

export default function RemotePadCanvas({
  documentState = { strokes: [], shapes: [], textBlocks: [] },
  onSendOp,
  onSendCursor,
  targetDeviceName = 'Desktop PC',
  notebookTitle = 'Notebook',
  pages = [],
  activePageIndex = 0,
  onSelectPage,
  onCreatePage,
  syncStatus = 'saved',
  isCanvasOnly = false,
  backgroundType: backgroundTypeProp,
  onExit
}) {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const draftCanvasRef = useRef(null);

  // Active tools & styles
  const [tool, setTool] = useState('pen'); // 'pen' | 'pencil' | 'highlighter' | 'eraser' | 'hand' | 'rect' | 'circle' | 'line' | 'arrow'
  const [color, setColor] = useState('#0f172a');
  const [strokeWidth, setStrokeWidth] = useState(4);
  const [backgroundType, setBackgroundType] = useState(
    backgroundTypeProp || pages[activePageIndex]?.background_type || 'dotted'
  );

  useEffect(() => {
    const bg = backgroundTypeProp || pages[activePageIndex]?.background_type;
    if (bg) {
      setBackgroundType(bg);
    }
  }, [backgroundTypeProp, pages, activePageIndex]);

  // Palm rejection / Stylus Mode
  // When active, finger touches won't draw strokes (only active stylus e.pointerType === 'pen' draws)
  const [palmRejection, setPalmRejection] = useState(false);

  // Dark mode
  const [isDarkMode, setIsDarkMode] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedTheme = localStorage.getItem('tablet_canvas_theme');
      if (savedTheme === 'dark') {
        setIsDarkMode(true);
        setColor('#f8fafc');
      }
    }
  }, []);

  const toggleDarkMode = () => {
    vibrate(10);
    setIsDarkMode((prev) => {
      const next = !prev;
      if (typeof window !== 'undefined') {
        localStorage.setItem('tablet_canvas_theme', next ? 'dark' : 'light');
      }
      if (next && (color === '#0f172a' || color === '#1e293b' || color === '#475569')) {
        setColor('#f8fafc');
      } else if (!next && (color === '#f8fafc' || color === '#ffffff')) {
        setColor('#0f172a');
      }
      showToast(next ? 'Dark Canvas: ON' : 'Light Canvas: ON');
      return next;
    });
  };

  // Viewport transforms (Zoom & Pan)
  const [zoom, setZoom] = useState(1.0);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const zoomRef = useRef(1.0);
  const panRef = useRef({ x: 0, y: 0 });
  zoomRef.current = zoom;
  panRef.current = pan;

  // History stacks
  const [undoStack, setUndoStack] = useState([]);
  const [redoStack, setRedoStack] = useState([]);

  // UI state popups & modals
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showShapesMenu, setShowShapesMenu] = useState(false);
  const [showWidthMenu, setShowWidthMenu] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showPageMenu, setShowPageMenu] = useState(false);
  const [showBackgroundMenu, setShowBackgroundMenu] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);

  // Gesture refs
  const isDrawingRef = useRef(false);
  const currentPointsRef = useRef([]);
  const shapeStartRef = useRef(null);
  const handDragStartRef = useRef(null);
  const activePointersRef = useRef(new Map());
  const pinchStartRef = useRef(null);
  const toastTimeoutRef = useRef(null);
  const newlyCreatedBlockIdRef = useRef(null);

  const vibrate = (ms = 12) => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try {
        navigator.vibrate(ms);
      } catch (_) {}
    }
  };

  const showToast = (msg) => {
    setToastMessage(msg);
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    toastTimeoutRef.current = setTimeout(() => setToastMessage(null), 2400);
  };

  // Fullscreen toggle
  const toggleFullscreen = () => {
    vibrate(10);
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
      showToast('Entered Fullscreen');
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
      showToast('Exited Fullscreen');
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Zoom control helpers
  const handleZoomChange = (delta) => {
    vibrate(8);
    setZoom((prev) => {
      const next = Math.min(Math.max(Number((prev + delta).toFixed(2)), 0.25), 4.0);
      showToast(`Zoom: ${Math.round(next * 100)}%`);
      return next;
    });
  };

  const handleResetView = () => {
    vibrate(10);
    setZoom(1.0);
    setPan({ x: 0, y: 0 });
    showToast('View Reset (100%)');
  };

  // Non-passive wheel event handling
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const handleWheel = (e) => {
      if (e.cancelable) e.preventDefault();
      if (e.ctrlKey || e.metaKey) {
        const factor = e.deltaY < 0 ? 1.08 : 0.92;
        setZoom(prev => Math.min(Math.max(Number((prev * factor).toFixed(2)), 0.25), 4.0));
      } else {
        setPan(prev => ({ x: prev.x - e.deltaX, y: prev.y - e.deltaY }));
      }
    };
    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => container.removeEventListener('wheel', handleWheel);
  }, []);

  // Resize canvas
  const resizeCanvas = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    const width = container.clientWidth;
    const height = container.clientHeight;
    const dpr = window.devicePixelRatio || 1;

    [canvasRef.current, draftCanvasRef.current].forEach((canvas) => {
      if (canvas) {
        canvas.width = width * dpr;
        canvas.height = height * dpr;
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;
        const ctx = canvas.getContext('2d');
        ctx.scale(dpr, dpr);
      }
    });

    drawMainCanvas();
  }, [documentState, zoom, pan, backgroundType, isDarkMode]);

  useEffect(() => {
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    return () => window.removeEventListener('resize', resizeCanvas);
  }, [resizeCanvas]);

  // Redraw all strokes, shapes, and background
  const drawMainCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const width = canvas.width / (window.devicePixelRatio || 1);
    const height = canvas.height / (window.devicePixelRatio || 1);

    ctx.clearRect(0, 0, width, height);

    // Background paper
    drawBackgroundPattern(ctx, width, height, backgroundType, zoom, pan.x, pan.y);

    // Apply viewport transform (Pan & Zoom)
    ctx.save();
    ctx.translate(pan.x, pan.y);
    ctx.scale(zoom, zoom);

    // Render remote and local shapes
    if (documentState.shapes) {
      for (const shape of documentState.shapes) {
        if (isDarkMode && (shape.color === '#0f172a' || shape.color === '#1e293b' || shape.color === '#000000')) {
          renderShape(ctx, { ...shape, color: '#f8fafc' });
        } else if (!isDarkMode && (shape.color === '#f8fafc' || shape.color === '#ffffff')) {
          renderShape(ctx, { ...shape, color: '#0f172a' });
        } else {
          renderShape(ctx, shape);
        }
      }
    }

    // Render strokes
    if (documentState.strokes) {
      for (const stroke of documentState.strokes) {
        if (isDarkMode && (stroke.color === '#0f172a' || stroke.color === '#1e293b' || stroke.color === '#000000')) {
          renderStroke(ctx, { ...stroke, color: '#f8fafc' });
        } else if (!isDarkMode && (stroke.color === '#f8fafc' || stroke.color === '#ffffff')) {
          renderStroke(ctx, { ...stroke, color: '#0f172a' });
        } else {
          renderStroke(ctx, stroke);
        }
      }
    }

    ctx.restore();
  }, [documentState, zoom, pan, backgroundType, isDarkMode]);

  useEffect(() => {
    drawMainCanvas();
  }, [drawMainCanvas]);

  function drawBackgroundPattern(ctx, width, height, type, z, px, py) {
    ctx.save();
    ctx.fillStyle = isDarkMode ? '#0f172a' : '#ffffff';
    ctx.fillRect(0, 0, width, height);

    if (type === 'blank') {
      ctx.restore();
      return;
    }

    const gridSize = 28 * z;
    const offsetX = ((px % gridSize) + gridSize) % gridSize;
    const offsetY = ((py % gridSize) + gridSize) % gridSize;

    if (type === 'dotted') {
      ctx.fillStyle = isDarkMode ? '#475569' : '#94a3b8';
      const dotRadius = Math.max(1.0, 1.35 * Math.min(z, 1.5));
      for (let x = offsetX; x < width; x += gridSize) {
        for (let y = offsetY; y < height; y += gridSize) {
          ctx.beginPath();
          ctx.arc(x, y, dotRadius, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    } else if (type === 'grid') {
      ctx.strokeStyle = isDarkMode ? '#334155' : '#cbd5e1';
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
    } else if (type === 'ruled') {
      const lineSpacing = 32 * z;
      const offY = ((py % lineSpacing) + lineSpacing) % lineSpacing;
      ctx.strokeStyle = isDarkMode ? '#334155' : '#cbd5e1';
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
        ctx.strokeStyle = isDarkMode ? '#e11d4866' : '#f43f5e55';
        ctx.lineWidth = 1.5;
        const lineMarginX = Math.floor(marginScreenX) + 0.5;
        ctx.moveTo(lineMarginX, 0);
        ctx.lineTo(lineMarginX, height);
        ctx.stroke();
      }
    }

    ctx.restore();
  }

  // Pointer event handlers
  const handlePointerDown = (e) => {
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;

    // Track pointer
    activePointersRef.current.set(e.pointerId, {
      x: screenX,
      y: screenY,
      type: e.pointerType
    });

    // Multi-touch pinch-to-zoom detection
    if (activePointersRef.current.size === 2) {
      isDrawingRef.current = false;
      currentPointsRef.current = [];
      shapeStartRef.current = null;
      handDragStartRef.current = null;

      // Clear draft canvas
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

    // Hand tool / Pan mode
    if (tool === 'hand') {
      handDragStartRef.current = {
        startX: screenX,
        startY: screenY,
        initialPanX: panRef.current.x,
        initialPanY: panRef.current.y
      };
      return;
    }

    // Palm Rejection: If enabled, touch (finger/palm) is ignored for drawing; only pen draws
    if (palmRejection && e.pointerType === 'touch') {
      return;
    }

    // Capture pointer so events keep firing even if pointer leaves the element (critical on mobile)
    try { e.target.setPointerCapture(e.pointerId); } catch (_) {}

    // World coordinate conversion
    const world = screenToWorld(screenX, screenY, zoomRef.current, panRef.current.x, panRef.current.y);

    // Text note creation directly on canvas (matching PC in-canvas text)
    if (tool === 'text') {
      const textColor = isDarkMode ? '#f8fafc' : (color === '#ffffff' || color === '#f8fafc' ? '#0f172a' : color || '#0f172a');
      const newBlock = {
        id: 'txt_' + Math.random().toString(36).substring(2, 10),
        x: Math.round(world.x),
        y: Math.round(world.y),
        width: 320,
        text: '',
        color: textColor,
        fontSize: Math.max(16, strokeWidth * 3)
      };
      newlyCreatedBlockIdRef.current = newBlock.id;
      onSendOp({ type: 'text:update', textBlock: newBlock });
      setTool('hand');
      vibrate(8);
      return;
    }

    if (tool === 'eraser') {
      isDrawingRef.current = true; // mark as erasing so pointerMove continues to erase
      handleEraserAt(world.x, world.y);
      return;
    }

    const isShapeTool = ['rect', 'circle', 'line', 'arrow'].includes(tool);
    if (isShapeTool) {
      isDrawingRef.current = true;
      shapeStartRef.current = { x: world.x, y: world.y };
      return;
    }

    // Freehand drawing (Pen, Pencil, Highlighter)
    isDrawingRef.current = true;
    currentPointsRef.current = [{
      x: world.x,
      y: world.y,
      pressure: e.pressure || 0.5
    }];
  };

  const handlePointerMove = (e) => {
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;

    if (activePointersRef.current.has(e.pointerId)) {
      activePointersRef.current.set(e.pointerId, {
        x: screenX,
        y: screenY,
        type: e.pointerType
      });
    }

    // Handle 2-finger pinch & pan
    if (activePointersRef.current.size === 2 && pinchStartRef.current) {
      const pts = Array.from(activePointersRef.current.values());
      const newDist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
      const ratio = newDist / (pinchStartRef.current.distance || 1);
      const newZoom = Math.min(Math.max(Number((pinchStartRef.current.initialZoom * ratio).toFixed(2)), 0.25), 4.0);

      const newMidX = (pts[0].x + pts[1].x) / 2;
      const newMidY = (pts[0].y + pts[1].y) / 2;
      const dx = newMidX - pinchStartRef.current.midX;
      const dy = newMidY - pinchStartRef.current.midY;

      setZoom(newZoom);
      setPan({
        x: pinchStartRef.current.initialPan.x + dx,
        y: pinchStartRef.current.initialPan.y + dy
      });
      return;
    }

    // Hand tool pan
    if (tool === 'hand' && handDragStartRef.current) {
      const dx = screenX - handDragStartRef.current.startX;
      const dy = screenY - handDragStartRef.current.startY;
      setPan({
        x: handDragStartRef.current.initialPanX + dx,
        y: handDragStartRef.current.initialPanY + dy
      });
      return;
    }

    // Palm rejection check
    if (palmRejection && e.pointerType === 'touch' && !isDrawingRef.current) {
      return;
    }

    const world = screenToWorld(screenX, screenY, zoomRef.current, panRef.current.x, panRef.current.y);

    // Send live cursor coordinates in world space to desktop PC
    onSendCursor(world.x, world.y);

    if (!isDrawingRef.current) return;

    if (tool === 'eraser') {
      handleEraserAt(world.x, world.y);
      return;
    }

    const isShapeTool = ['rect', 'circle', 'line', 'arrow'].includes(tool);
    const draftCanvas = draftCanvasRef.current;
    if (!draftCanvas) return;
    const ctx = draftCanvas.getContext('2d');
    const width = draftCanvas.width / (window.devicePixelRatio || 1);
    const height = draftCanvas.height / (window.devicePixelRatio || 1);

    ctx.clearRect(0, 0, width, height);

    ctx.save();
    ctx.translate(panRef.current.x, panRef.current.y);
    ctx.scale(zoomRef.current, zoomRef.current);

    if (isShapeTool && shapeStartRef.current) {
      renderShape(ctx, {
        type: tool,
        startX: shapeStartRef.current.x,
        startY: shapeStartRef.current.y,
        endX: world.x,
        endY: world.y,
        color,
        width: strokeWidth,
        fillColor: 'transparent',
        opacity: 1
      });
    } else {
      currentPointsRef.current.push({
        x: world.x,
        y: world.y,
        pressure: e.pressure || 0.5
      });

      const isHighlighter = tool === 'highlighter';
      const effectiveWidth = isHighlighter ? Math.max(strokeWidth * 2, 16) : strokeWidth;
      renderStroke(ctx, {
        tool,
        points: currentPointsRef.current,
        color,
        width: effectiveWidth,
        opacity: isHighlighter ? 0.35 : 1
      });
    }

    ctx.restore();
  };

  const handlePointerUp = (e) => {
    if (e && e.pointerId) {
      activePointersRef.current.delete(e.pointerId);
    }
    if (activePointersRef.current.size < 2) {
      pinchStartRef.current = null;
    }

    if (tool === 'hand') {
      handDragStartRef.current = null;
      return;
    }

    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;

    // Clear draft canvas
    const draftCanvas = draftCanvasRef.current;
    if (draftCanvas) {
      const ctx = draftCanvas.getContext('2d');
      const width = draftCanvas.width / (window.devicePixelRatio || 1);
      const height = draftCanvas.height / (window.devicePixelRatio || 1);
      ctx.clearRect(0, 0, width, height);
    }

    const isShapeTool = ['rect', 'circle', 'line', 'arrow'].includes(tool);

    if (isShapeTool && shapeStartRef.current) {
      const container = containerRef.current;
      if (container) {
        const rect = container.getBoundingClientRect();
        const screenX = e.clientX - rect.left;
        const screenY = e.clientY - rect.top;
        const world = screenToWorld(screenX, screenY, zoomRef.current, panRef.current.x, panRef.current.y);

        const dx = Math.abs(world.x - shapeStartRef.current.x);
        const dy = Math.abs(world.y - shapeStartRef.current.y);
        if (dx > 4 || dy > 4) {
          const shape = {
            id: 'shp_' + Math.random().toString(36).substring(2, 10),
            type: tool,
            startX: shapeStartRef.current.x,
            startY: shapeStartRef.current.y,
            endX: world.x,
            endY: world.y,
            color,
            width: strokeWidth,
            fillColor: 'transparent',
            opacity: 1
          };
          shapeStartRef.current = null;
          setUndoStack((prev) => [...prev, { type: 'shape:delete', shapeId: shape.id, shape }]);
          setRedoStack([]);
          onSendOp({ type: 'shape:add', shape });
          vibrate(8);
        }
      }
      return;
    }

    // Commit freehand stroke
    if (currentPointsRef.current.length > 0) {
      const simplified = simplifyPoints(currentPointsRef.current, 1.2);
      const isHighlighter = tool === 'highlighter';
      const effectiveWidth = isHighlighter ? Math.max(strokeWidth * 2, 16) : strokeWidth;
      const stroke = {
        id: 'strk_' + Math.random().toString(36).substring(2, 10),
        tool,
        points: simplified,
        color,
        width: effectiveWidth,
        opacity: isHighlighter ? 0.35 : 1
      };
      currentPointsRef.current = [];
      setUndoStack((prev) => [...prev, { type: 'stroke:erase', strokeId: stroke.id, stroke }]);
      setRedoStack([]);
      onSendOp({ type: 'stroke:add', stroke });
      vibrate(8);
    }
  };

  const handleEraserAt = (worldX, worldY) => {
    // Check strokes first
    if (documentState.strokes) {
      for (const stroke of documentState.strokes) {
        if (hitTestStroke(stroke, worldX, worldY, 18 / zoomRef.current)) {
          vibrate(15);
          setUndoStack((prev) => [...prev, { type: 'stroke:add', stroke }]);
          setRedoStack([]);
          onSendOp({ type: 'stroke:erase', strokeId: stroke.id });
          return;
        }
      }
    }

    // Check shapes
    if (documentState.shapes) {
      for (const shape of documentState.shapes) {
        if (hitTestShape(shape, worldX, worldY)) {
          vibrate(15);
          setUndoStack((prev) => [...prev, { type: 'shape:add', shape }]);
          setRedoStack([]);
          onSendOp({ type: 'shape:delete', shapeId: shape.id });
          return;
        }
      }
    }
  };

  const handleUndo = () => {
    vibrate(12);
    if (undoStack.length === 0) return;
    const lastOp = undoStack[undoStack.length - 1];
    setUndoStack(undoStack.slice(0, -1));
    setRedoStack([...redoStack, lastOp]);
    onSendOp(lastOp);
    showToast('Undo');
  };

  const handleRedo = () => {
    vibrate(12);
    if (redoStack.length === 0) return;
    const lastOp = redoStack[redoStack.length - 1];
    setRedoStack(redoStack.slice(0, -1));
    setUndoStack([...undoStack, lastOp]);

    if (lastOp.type === 'stroke:erase') {
      const stroke = lastOp.stroke || documentState.strokes?.find(s => s.id === lastOp.strokeId);
      if (stroke) onSendOp({ type: 'stroke:add', stroke });
    } else if (lastOp.type === 'shape:delete') {
      const shape = lastOp.shape || documentState.shapes?.find(s => s.id === lastOp.shapeId);
      if (shape) onSendOp({ type: 'shape:add', shape });
    } else if (lastOp.type === 'stroke:add') {
      if (lastOp.stroke?.id || lastOp.strokeId) {
        onSendOp({ type: 'stroke:erase', strokeId: lastOp.stroke?.id || lastOp.strokeId });
      }
    } else if (lastOp.type === 'shape:add') {
      if (lastOp.shape?.id || lastOp.shapeId) {
        onSendOp({ type: 'shape:delete', shapeId: lastOp.shape?.id || lastOp.shapeId });
      }
    } else {
      onSendOp(lastOp);
    }
    showToast('Redo');
  };

  const handleConfirmClear = () => {
    vibrate(20);
    onSendOp({ type: 'stroke:clear' });
    setShowClearConfirm(false);
    showToast('Page Canvas Cleared');
  };

  const togglePalmRejection = () => {
    vibrate(10);
    setPalmRejection(prev => {
      const next = !prev;
      showToast(next ? 'Stylus Only: Palm Rejection ON' : 'Touch & Stylus Drawing ON');
      return next;
    });
  };

  const activePage = pages[activePageIndex] || { title: 'Page 1' };
  const activeShapeTool = SHAPE_TOOLS.find(s => s.id === tool);

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-slate-950 select-none touch-none font-sans text-slate-100">
      {/* Toast Notification Banner */}
      {toastMessage && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-50 pointer-events-none transition-all duration-200">
          <div className="bg-slate-900/90 text-white text-xs font-semibold px-4 py-2 rounded-full shadow-xl border border-slate-700/80 backdrop-blur-md flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></span>
            {toastMessage}
          </div>
        </div>
      )}

      {/* Modern Tablet Top Header Bar */}
      <header className="flex items-center justify-between px-3 md:px-5 py-2.5 bg-slate-900/95 border-b border-slate-800/80 backdrop-blur-md z-30 shadow-xs">
        {/* Left: Exit/Disconnect button & Notebook Page Title with Dropdown */}
        <div className="flex items-center gap-2.5">
          {onExit && (
            <button
              type="button"
              onClick={onExit}
              title={isCanvasOnly ? "Disconnect Drawing Pad" : "Return to notebook overview"}
              className={`p-2 rounded-xl transition-colors ${
                isCanvasOnly
                  ? "text-slate-400 hover:text-rose-400 hover:bg-rose-950/30 border border-slate-800"
                  : "text-slate-400 hover:text-white hover:bg-slate-800/80"
              }`}
            >
              {isCanvasOnly ? <Power className="w-4 h-4" /> : <ArrowLeft className="w-4 h-4" />}
            </button>
          )}

          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setShowPageMenu(!showPageMenu);
                setShowBackgroundMenu(false);
              }}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700/60 transition-colors text-left"
            >
              <div className="w-6 h-6 rounded-lg bg-indigo-600 flex items-center justify-center font-bold text-[11px] text-white shadow-xs">
                P{activePageIndex + 1}
              </div>
              <div className="max-w-[140px] md:max-w-[200px] truncate">
                <p className="text-xs font-semibold text-slate-200 truncate leading-tight">
                  {notebookTitle}
                </p>
                <p className="text-[10px] text-slate-400 truncate">
                  {activePage.title} • {pages.length} {pages.length === 1 ? 'page' : 'pages'}
                </p>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </button>

            {/* Pages Navigation Popover */}
            {showPageMenu && (
              <div className="absolute top-full left-0 mt-2 w-64 bg-slate-900 rounded-2xl shadow-2xl border border-slate-800 p-2 z-50">
                <div className="flex items-center justify-between px-2 py-1 mb-1">
                  <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Notebook Pages</span>
                  {!isCanvasOnly && onCreatePage && (
                    <button
                      type="button"
                      onClick={() => {
                        onCreatePage();
                        setShowPageMenu(false);
                      }}
                      className="text-[11px] text-indigo-400 hover:text-indigo-300 font-medium flex items-center gap-1"
                    >
                      <Plus className="w-3 h-3" /> New
                    </button>
                  )}
                </div>

                <div className="max-h-56 overflow-y-auto space-y-1">
                  {pages.map((p, idx) => (
                    <button
                      key={p.id || idx}
                      type="button"
                      onClick={() => {
                        onSelectPage?.(idx);
                        setShowPageMenu(false);
                      }}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-colors ${
                        activePageIndex === idx
                          ? 'bg-indigo-600 text-white shadow-sm'
                          : 'text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      <span className="truncate">Page {idx + 1}: {p.title}</span>
                      {activePageIndex === idx && <Check className="w-3.5 h-3.5" />}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Quick Page Prev/Next Steppers */}
          {pages.length > 1 && (
            <div className="hidden sm:flex items-center gap-1 bg-slate-800/80 p-0.5 rounded-xl border border-slate-700/60">
              <button
                type="button"
                disabled={activePageIndex <= 0}
                onClick={() => onSelectPage?.(activePageIndex - 1)}
                className="p-1 rounded-lg text-slate-400 hover:text-white disabled:opacity-30 transition-colors"
                title="Previous Page"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-[11px] font-mono px-1 text-slate-300">
                {activePageIndex + 1}/{pages.length}
              </span>
              <button
                type="button"
                disabled={activePageIndex >= pages.length - 1}
                onClick={() => onSelectPage?.(activePageIndex + 1)}
                className="p-1 rounded-lg text-slate-400 hover:text-white disabled:opacity-30 transition-colors"
                title="Next Page"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* Center: Live PC Bridge & Sync Status */}
        <div className="flex items-center gap-2">
          {isCanvasOnly && (
            <div
              className="flex items-center gap-1 bg-amber-500/10 px-2.5 py-1 rounded-full border border-amber-500/20 text-amber-300 text-[11px] font-medium"
              title="Restricted drawing pad mode: Canvas writing only. No account or user data access."
            >
              <Lock className="w-3 h-3 text-amber-400" />
              <span className="hidden sm:inline">Canvas Only</span>
            </div>
          )}

          <div className="flex items-center gap-2 bg-slate-800/90 px-3 py-1.5 rounded-full border border-slate-700/80 shadow-inner">
            <Laptop className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-xs font-medium text-slate-200 hidden md:inline">
              Paired with {targetDeviceName}
            </span>
            <span className="text-xs font-medium text-slate-200 md:hidden">
              Paired
            </span>
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          </div>

          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-800/80 border border-slate-700/60 text-[11px] text-slate-300 shadow-xs">
            {syncStatus === 'syncing' ? (
              <>
                <span className="w-2 h-2 rounded-full border-2 border-amber-400 border-t-transparent animate-spin"></span>
                <span className="text-amber-300 font-medium">Syncing...</span>
              </>
            ) : syncStatus === 'offline' ? (
              <>
                <WifiOff className="w-3 h-3 text-rose-400" />
                <span className="text-rose-400 font-medium">Offline (Connecting...)</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                <span className="text-emerald-400 font-medium">Synced with PC</span>
              </>
            )}
          </div>
        </div>

        {/* Right: Palm Rejection Toggle, Paper Style, Fullscreen */}
        <div className="flex items-center gap-1.5">
          {/* Palm Rejection Stylus Priority Button */}
          <button
            type="button"
            onClick={togglePalmRejection}
            title={palmRejection ? 'Palm Rejection Active: Only Stylus / Apple Pencil draws' : 'Touch Mode: Fingers can draw'}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              palmRejection
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30 ring-2 ring-indigo-400/40'
                : 'bg-slate-800/90 text-slate-300 hover:text-white border border-slate-700'
            }`}
          >
            <Tablet className="w-3.5 h-3.5 text-indigo-400" />
            <span>
              {palmRejection ? 'Stylus Mode: ON (Palm Rejection)' : 'Stylus Mode: OFF'}
            </span>
          </button>

          {/* Paper Background Menu */}
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setShowBackgroundMenu(!showBackgroundMenu);
                setShowPageMenu(false);
              }}
              title="Paper Pattern"
              className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700/60 transition-colors"
            >
              <Grid className="w-4 h-4" />
            </button>

            {showBackgroundMenu && (
              <div className="absolute top-full right-0 mt-2 w-36 bg-slate-900 rounded-2xl shadow-2xl border border-slate-800 p-1.5 z-50">
                {BACKGROUND_TYPES.map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => {
                      setBackgroundType(b.id);
                      setShowBackgroundMenu(false);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-1.5 rounded-xl text-xs font-medium transition-colors ${
                      backgroundType === b.id
                        ? 'bg-indigo-600 text-white'
                        : 'text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    <span>{b.label}</span>
                    {backgroundType === b.id && <Check className="w-3 h-3" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Dark Mode Toggle */}
          <button
            type="button"
            onClick={toggleDarkMode}
            title={isDarkMode ? 'Switch to Light Canvas' : 'Switch to Dark Canvas'}
            className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700/60 transition-colors"
          >
            {isDarkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-300" />}
          </button>

          {/* Fullscreen Button */}
          <button
            type="button"
            onClick={toggleFullscreen}
            title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
            className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700/60 transition-colors"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </header>

      {/* Main Touch Canvas Viewport */}
      <div
        ref={containerRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        onPointerCancel={handlePointerUp}
        className={`relative flex-1 ${isDarkMode ? 'bg-slate-900' : 'bg-white'} touch-none ${
          tool === 'hand' ? 'cursor-grab active:cursor-grabbing' : tool === 'text' ? 'cursor-text' : 'cursor-crosshair'
        }`}
      >
        <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none" />
        <canvas ref={draftCanvasRef} className="absolute inset-0 pointer-events-none" />

        {/* World-space Canvas Viewport Layer: Transforms all in-canvas HTML elements in 100% exact sync with 2D canvas */}
        <div
          className="absolute inset-0 pointer-events-none origin-top-left overflow-visible"
          style={{
            transform: `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${zoom})`,
            transformOrigin: '0 0'
          }}
        >
          {documentState.textBlocks?.map((block) => (
            <StickyTextBlock
              key={block.id}
              block={block}
              zoom={zoom}
              panX={pan.x}
              panY={pan.y}
              isDarkModeOverride={isDarkMode}
              canEditOverride={true}
              toolOverride={tool}
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

        {/* Type Mode Helper Banner */}
        {tool === 'text' && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 px-3 py-1.5 bg-indigo-600 text-white rounded-full shadow-lg text-xs font-medium animate-pulse">
            <Type size={14} />
            <span>Type Mode: Tap anywhere on canvas to write a note</span>
            <button
              onClick={() => {
                setTool('pen');
                vibrate(8);
              }}
              className="ml-2 px-2 py-0.5 bg-white/20 hover:bg-white/30 rounded text-[11px] font-semibold"
            >
              Draw Mode
            </button>
          </div>
        )}

        {/* Floating Zoom & Reset View HUD */}
        <div className="absolute top-4 right-4 z-20 flex items-center gap-1 bg-slate-900/90 backdrop-blur-md p-1 rounded-2xl border border-slate-700/80 shadow-lg pointer-events-auto">
          <button
            type="button"
            onClick={() => handleZoomChange(-0.1)}
            disabled={zoom <= 0.25}
            title="Zoom Out"
            className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-300 hover:text-white hover:bg-slate-800 active:scale-95 disabled:opacity-30 transition-all"
          >
            <Minus className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={handleResetView}
            title="Reset View (100%)"
            className="px-2.5 h-8 rounded-xl text-xs font-mono font-semibold text-slate-200 hover:text-white hover:bg-slate-800 active:scale-95 transition-all"
          >
            {Math.round(zoom * 100)}%
          </button>

          <button
            type="button"
            onClick={() => handleZoomChange(0.1)}
            disabled={zoom >= 4.0}
            title="Zoom In"
            className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-300 hover:text-white hover:bg-slate-800 active:scale-95 disabled:opacity-30 transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Interactive Canvas MiniMap on Connected Device */}
        <MiniMap
          documentState={documentState}
          containerRef={containerRef}
          zoomOverride={zoom}
          panXOverride={pan.x}
          panYOverride={pan.y}
          setPanOverride={(nx, ny) => setPan({ x: nx, y: ny })}
          resetViewOverride={handleResetView}
          isRemotePad={true}
        />
      </div>

      {/* Touch-Optimized Ergonomic Bottom Dock */}
      <footer className="relative bg-slate-950/95 border-t border-slate-800/80 px-2 sm:px-4 py-2.5 z-30 flex flex-wrap items-center justify-between gap-2 shadow-2xl backdrop-blur-md">
        
        {/* Draw vs Type Mode Toggle */}
        <div className="flex items-center p-0.5 bg-slate-900/90 rounded-2xl border border-slate-800/80 shadow-inner">
          <button
            type="button"
            onClick={() => {
              if (tool === 'text') setTool('pen');
              vibrate(8);
            }}
            title="Draw Mode: Draw freehand or geometric shapes"
            className={`p-2 sm:px-2.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
              tool !== 'text' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Pen className="w-4 h-4" />
            <span className="hidden sm:inline">Draw</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setTool('text');
              vibrate(8);
            }}
            title="Type Note Mode: Tap anywhere to type note"
            className={`p-2 sm:px-2.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
              tool === 'text' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Type className="w-4 h-4" />
            <span className="hidden sm:inline">Type Note</span>
          </button>
        </div>

        {/* Drawing Tools Group */}
        <div className="flex items-center gap-1.5 bg-slate-900/90 p-1 rounded-2xl border border-slate-800/80 shadow-inner">
          <button
            type="button"
            onClick={() => { setTool('pen'); vibrate(10); }}
            title="Pen (Natural Ink)"
            className={`p-2.5 sm:p-3 rounded-xl transition-all duration-150 flex items-center justify-center ${
              tool === 'pen'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30 scale-105'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/70'
            }`}
          >
            <Pen className="w-5 h-5" />
          </button>

          <button
            type="button"
            onClick={() => { setTool('pencil'); vibrate(10); }}
            title="Pencil (Graphite Sketch)"
            className={`p-2.5 sm:p-3 rounded-xl transition-all duration-150 flex items-center justify-center ${
              tool === 'pencil'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30 scale-105'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/70'
            }`}
          >
            <Pencil className="w-5 h-5" />
          </button>

          <button
            type="button"
            onClick={() => { setTool('highlighter'); vibrate(10); }}
            title="Highlighter"
            className={`p-2.5 sm:p-3 rounded-xl transition-all duration-150 flex items-center justify-center ${
              tool === 'highlighter'
                ? 'bg-amber-500 text-white shadow-md shadow-amber-500/30 scale-105'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/70'
            }`}
          >
            <Highlighter className="w-5 h-5" />
          </button>

          <button
            type="button"
            onClick={() => { setTool('eraser'); vibrate(10); }}
            title="Eraser (Object / Stroke)"
            className={`p-2.5 sm:p-3 rounded-xl transition-all duration-150 flex items-center justify-center ${
              tool === 'eraser'
                ? 'bg-rose-600 text-white shadow-md shadow-rose-600/30 scale-105'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/70'
            }`}
          >
            <Eraser className="w-5 h-5" />
          </button>

          {/* Shapes Tool Button with Popover */}
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setShowShapesMenu(!showShapesMenu);
                setShowWidthMenu(false);
                vibrate(10);
              }}
              title="Geometric Shapes"
              className={`p-2.5 sm:p-3 rounded-xl transition-all duration-150 flex items-center justify-center ${
                activeShapeTool
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30 scale-105'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/70'
              }`}
            >
              {activeShapeTool ? (
                <activeShapeTool.icon className="w-5 h-5" />
              ) : (
                <Square className="w-5 h-5" />
              )}
            </button>

            {showShapesMenu && (
              <div className="absolute bottom-full left-0 mb-3 bg-slate-900 rounded-2xl shadow-2xl border border-slate-800 p-2 flex items-center gap-1.5 z-50">
                {SHAPE_TOOLS.map((s) => {
                  const Icon = s.icon;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => {
                        setTool(s.id);
                        setShowShapesMenu(false);
                        vibrate(10);
                      }}
                      className={`p-2.5 rounded-xl transition-all ${
                        tool === s.id ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800'
                      }`}
                      title={s.label}
                    >
                      <Icon className="w-5 h-5" />
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Hand / Pan Tool */}
          <button
            type="button"
            onClick={() => { setTool('hand'); vibrate(10); }}
            title="Hand Tool (Pan Canvas)"
            className={`p-2.5 sm:p-3 rounded-xl transition-all duration-150 flex items-center justify-center ${
              tool === 'hand'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30 scale-105'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/70'
            }`}
          >
            <Hand className="w-5 h-5" />
          </button>

          {/* Stylus Mode (Palm Rejection) Dock Quick Toggle */}
          <button
            type="button"
            onClick={togglePalmRejection}
            title={palmRejection ? 'Stylus Mode Active: Only Stylus / Apple Pencil draws (Palm Rejection ON)' : 'Touch Mode: Fingers can draw (Click to activate Stylus Mode)'}
            className={`p-2.5 sm:p-3 rounded-xl transition-all duration-150 flex items-center justify-center relative ${
              palmRejection
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30 ring-2 ring-indigo-400/50 scale-105'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/70'
            }`}
          >
            <Tablet className="w-5 h-5" />
            {palmRejection && (
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-400 rounded-full border border-slate-900 animate-pulse"></span>
            )}
          </button>
        </div>

        {/* Color Palette Swatches & Custom Picker */}
        <div className="flex items-center gap-1.5 bg-slate-900/90 p-1.5 rounded-2xl border border-slate-800/80 shadow-inner">
          {(isDarkMode ? DARK_PAD_COLORS : LIGHT_PAD_COLORS).map((c) => (
            <button
              key={c.hex}
              type="button"
              onClick={() => { setColor(c.hex); vibrate(8); }}
              title={c.name}
              className={`w-7 h-7 rounded-full transition-transform duration-150 border-2 ${
                color === c.hex
                  ? 'scale-125 ring-2 ring-indigo-400 ring-offset-2 ring-offset-slate-950 border-white shadow-md'
                  : 'border-transparent hover:scale-110'
              }`}
              style={{ backgroundColor: c.hex }}
            />
          ))}

          {/* Native Color Picker Trigger */}
          <div className="relative flex items-center justify-center">
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
              title="Custom Color"
            />
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center border-2 transition-transform ${
                !(isDarkMode ? DARK_PAD_COLORS : LIGHT_PAD_COLORS).some(c => c.hex === color)
                  ? 'scale-125 ring-2 ring-indigo-400 ring-offset-2 ring-offset-slate-950 border-white'
                  : 'border-slate-700 bg-gradient-to-tr from-pink-500 via-amber-400 to-indigo-500'
              }`}
              style={{ backgroundColor: !(isDarkMode ? DARK_PAD_COLORS : LIGHT_PAD_COLORS).some(c => c.hex === color) ? color : undefined }}
            >
              <Palette className="w-3.5 h-3.5 text-white drop-shadow-sm pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Thickness Controls */}
        <div className="relative">
          <button
            type="button"
            onClick={() => {
              setShowWidthMenu(!showWidthMenu);
              setShowShapesMenu(false);
              vibrate(10);
            }}
            title="Stroke Width"
            className="flex items-center gap-2 bg-slate-900/90 hover:bg-slate-900 px-3 py-2 rounded-2xl border border-slate-800/80 text-xs font-semibold text-slate-200 transition-colors"
          >
            <div
              className="rounded-full bg-slate-200"
              style={{ width: Math.max(strokeWidth, 4), height: Math.max(strokeWidth, 4) }}
            />
            <span>{strokeWidth}px</span>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          </button>

          {showWidthMenu && (
            <div className="absolute bottom-full right-0 mb-3 bg-slate-900 rounded-2xl shadow-2xl border border-slate-800 p-3 w-48 z-50">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-2">Stroke Width</span>
              <div className="grid grid-cols-2 gap-1.5 mb-3">
                {STROKE_WIDTH_PRESETS.map((p) => (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => {
                      setStrokeWidth(p.value);
                      setShowWidthMenu(false);
                      vibrate(8);
                    }}
                    className={`px-2.5 py-1.5 rounded-xl text-xs font-medium transition-colors ${
                      strokeWidth === p.value
                        ? 'bg-indigo-600 text-white'
                        : 'bg-slate-800 text-slate-300 hover:text-white'
                    }`}
                  >
                    {p.label} ({p.value}px)
                  </button>
                ))}
              </div>

              <input
                type="range"
                min="1"
                max="32"
                value={strokeWidth}
                onChange={(e) => setStrokeWidth(Number(e.target.value))}
                className="w-full accent-indigo-500"
              />
            </div>
          )}
        </div>

        {/* History Undo / Redo & Clear Group */}
        <div className="flex items-center gap-1.5 bg-slate-900/90 p-1 rounded-2xl border border-slate-800/80 shadow-inner">
          <button
            type="button"
            onClick={handleUndo}
            disabled={undoStack.length === 0}
            title="Undo"
            className="p-2.5 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800 active:scale-95 disabled:opacity-25 transition-all"
          >
            <Undo2 className="w-5 h-5" />
          </button>

          <button
            type="button"
            onClick={handleRedo}
            disabled={redoStack.length === 0}
            title="Redo"
            className="p-2.5 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800 active:scale-95 disabled:opacity-25 transition-all"
          >
            <Redo2 className="w-5 h-5" />
          </button>

          <button
            type="button"
            onClick={() => { setShowClearConfirm(true); vibrate(15); }}
            title="Clear Canvas"
            className="p-2.5 rounded-xl text-rose-400 hover:text-rose-300 hover:bg-rose-950/40 active:scale-95 transition-all"
          >
            <Trash2 className="w-5 h-5" />
          </button>
        </div>
      </footer>

      {/* Safety Clear Confirmation Modal */}
      {showClearConfirm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-sm w-full p-5 shadow-2xl text-center space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-full bg-rose-500/10 text-rose-400 flex items-center justify-center mx-auto border border-rose-500/20">
              <Trash2 className="w-6 h-6" />
            </div>

            <div>
              <h3 className="text-base font-semibold text-slate-100">Clear Canvas?</h3>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                This will erase all strokes from this page on both this tablet and the paired desktop.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowClearConfirm(false)}
                className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmClear}
                className="w-full py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold shadow-md shadow-rose-600/30 transition-colors"
              >
                Clear All
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
