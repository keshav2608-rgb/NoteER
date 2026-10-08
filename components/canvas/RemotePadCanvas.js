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
  Undo2,
  Redo2,
  Trash2,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Laptop,
  WifiOff,
  Check,
  Sliders,
  Palette,
  Tablet,
  Plus,
  ArrowLeft,
  Grid,
  Sun,
  Moon,
  Lock,
  Power
} from 'lucide-react';

const LIGHT_PAD_COLORS = [
  { name: 'Graphite', hex: '#0f172a' },
  { name: 'Pencil grey', hex: '#475569' },
  { name: 'Ballpoint blue', hex: '#2340c8' },
  { name: 'Green ink', hex: '#1f7a4d' },
  { name: 'Correction red', hex: '#c42e38' },
  { name: 'Sepia', hex: '#a15c12' },
  { name: 'Violet', hex: '#6d3fc0' }
];

const DARK_PAD_COLORS = [
  { name: 'Chalk white', hex: '#f8fafc' },
  { name: 'Highlighter yellow', hex: '#e2d348' },
  { name: 'Light blue', hex: '#92a5ff' },
  { name: 'Mint', hex: '#74cc94' },
  { name: 'Coral', hex: '#ff7d7d' },
  { name: 'Lilac', hex: '#c4a5ff' },
  { name: 'Grey', hex: '#94a3b8' }
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
    if (typeof window === 'undefined') return;
    let savedTheme = null;
    try {
      savedTheme = localStorage.getItem('tablet_canvas_theme');
    } catch (_) {}
    // No pad-specific choice yet: follow the app theme already applied to <html>
    const startDark = savedTheme
      ? savedTheme === 'dark'
      : document.documentElement.classList.contains('dark');
    if (startDark) {
      setIsDarkMode(true);
      setColor('#f8fafc');
    }
  }, []);

  // Keep the page chrome (token colours) in step with the pad's canvas theme
  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.documentElement.classList.toggle('dark', isDarkMode);
  }, [isDarkMode]);

  const toggleDarkMode = () => {
    vibrate(10);
    const next = !isDarkMode;
    try {
      localStorage.setItem('tablet_canvas_theme', next ? 'dark' : 'light');
    } catch (_) {}
    if (next && (color === '#0f172a' || color === '#1e293b' || color === '#475569')) {
      setColor('#f8fafc');
    } else if (!next && (color === '#f8fafc' || color === '#ffffff')) {
      setColor('#0f172a');
    }
    setIsDarkMode(next);
    showToast(next ? 'Dark paper' : 'Light paper');
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
      showToast('Fullscreen on');
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
      showToast('Fullscreen off');
    }
  };

  // Fullscreen API is missing on iPhone Safari; hide the button there
  const [canFullscreen, setCanFullscreen] = useState(false);
  useEffect(() => {
    setCanFullscreen(Boolean(document.fullscreenEnabled));
  }, []);

  // Undo history belongs to one page; drop it when the page changes
  useEffect(() => {
    setUndoStack([]);
    setRedoStack([]);
  }, [activePageIndex]);

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
    showToast('View reset to 100%');
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
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
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
    const dpr = window.devicePixelRatio || 1;
    const width = canvas.width / dpr;
    const height = canvas.height / dpr;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
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

    // Ensure draft canvas is clean when persistent document state is redrawn
    const draftCanvas = draftCanvasRef.current;
    if (draftCanvas) {
      const dCtx = draftCanvas.getContext('2d');
      dCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
      dCtx.clearRect(0, 0, width, height);
    }
  }, [documentState, zoom, pan, backgroundType, isDarkMode]);

  useEffect(() => {
    drawMainCanvas();
  }, [drawMainCanvas]);

  function drawBackgroundPattern(ctx, width, height, type, z, px, py) {
    ctx.save();
    ctx.fillStyle = isDarkMode ? '#222529' : '#FCFCFA';
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
      ctx.fillStyle = isDarkMode ? '#4A5057' : '#BFC4BB';
      const dotRadius = Math.max(1.5, 1.8 * Math.min(z, 1.5));
      for (let x = offsetX; x < width; x += gridSize) {
        for (let y = offsetY; y < height; y += gridSize) {
          ctx.beginPath();
          ctx.arc(x, y, dotRadius, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    } else if (paperType === 'grid') {
      ctx.strokeStyle = isDarkMode ? '#3A3F45' : '#D4D8D1';
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
      ctx.strokeStyle = isDarkMode ? '#3A3F45' : '#D4D8D1';
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
        ctx.strokeStyle = isDarkMode ? 'rgba(255,125,125,0.55)' : 'rgba(196,46,56,0.55)';
        ctx.lineWidth = 2;
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

    setShowShapesMenu(false);
    setShowWidthMenu(false);
    setShowPageMenu(false);
    setShowBackgroundMenu(false);

    // If pointer went down on a StickyTextBlock, don't intercept it
    const isOnTextBlock = e.target.closest?.('[data-text-block]');
    if (isOnTextBlock) return;

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
    if (tool !== 'hand' && tool !== 'text') {
      try { e.target.setPointerCapture(e.pointerId); } catch (_) {}
    }

    // World coordinate conversion
    const world = screenToWorld(screenX, screenY, zoomRef.current, panRef.current.x, panRef.current.y);

    // Text note creation directly on canvas (matching PC in-canvas text)
    if (tool === 'text') {
      try { e.preventDefault(); } catch (_) {}

      // If an empty text block already exists, relocate it to the new position
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
        setTool('hand');
        return;
      }

      const textColor = isDarkMode ? '#f8fafc' : (color === '#ffffff' || color === '#f8fafc' ? '#0f172a' : color || '#0f172a');
      const newBlock = {
        id: 'txt_' + Math.random().toString(36).substring(2, 10),
        x: Math.round(world.x),
        y: Math.round(world.y),
        width: 320,
        text: '',
        color: textColor,
        fontSize: Math.max(16, strokeWidth * 3),
        style: 'yellow'
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
          vibrate(15);
          setUndoStack((prev) => [...prev, { type: 'text:update', textBlock: block }]);
          setRedoStack([]);
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
    } else if (lastOp.type === 'text:update' && lastOp.textBlock?.id) {
      const id = lastOp.textBlock.id;
      onSendOp({ type: 'text:delete', textBlockId: id, textBlock: { id, deleted: true } });
    } else {
      onSendOp(lastOp);
    }
    showToast('Redo');
  };

  const handleConfirmClear = () => {
    vibrate(20);
    onSendOp({ type: 'stroke:clear' });
    setShowClearConfirm(false);
    showToast('Page cleared');
  };

  const togglePalmRejection = () => {
    vibrate(10);
    const next = !palmRejection;
    setPalmRejection(next);
    showToast(next ? "Stylus only: fingers won't draw" : 'Fingers and stylus both draw');
  };

  const activePage = pages[activePageIndex] || { title: 'Page 1' };
  const activeShapeTool = SHAPE_TOOLS.find(s => s.id === tool);

  const palette = isDarkMode ? DARK_PAD_COLORS : LIGHT_PAD_COLORS;
  const isCustomColor = !palette.some((c) => c.hex === color);

  const toolClass = (active) =>
    `w-11 h-11 shrink-0 rounded-ctl flex items-center justify-center transition-colors ${
      active ? 'hl' : 'text-pencil hover:text-ink hover:bg-paper-2'
    }`;

  const syncLabel =
    syncStatus === 'syncing' ? 'Syncing' : syncStatus === 'offline' ? 'Offline, reconnecting' : `Synced with ${targetDeviceName}`;
  const syncDot =
    syncStatus === 'syncing' ? 'bg-highlight animate-pulse-subtle' : syncStatus === 'offline' ? 'bg-correction' : 'bg-ok';

  const divider = <span aria-hidden="true" className="w-px h-7 bg-rule shrink-0 mx-0.5" />;

  return (
    <div className="flex flex-col h-[100dvh] w-screen overflow-hidden bg-desk select-none touch-none font-sans text-ink">
      {/* Toast */}
      {toastMessage && (
        <div
          role="status"
          className="fixed left-1/2 -translate-x-1/2 z-50 pointer-events-none"
          style={{ top: 'calc(env(safe-area-inset-top) + 4.25rem)' }}
        >
          <div className="bg-ink text-paper text-sm font-medium px-4 h-9 flex items-center rounded-ctl shadow-float whitespace-nowrap">
            {toastMessage}
          </div>
        </div>
      )}

      {/* Top bar */}
      <header
        className="relative z-30 flex items-center gap-1 sm:gap-2 pb-1.5 bg-paper border-b border-rule"
        style={{
          paddingTop: 'max(0.375rem, env(safe-area-inset-top))',
          paddingLeft: 'max(0.375rem, env(safe-area-inset-left))',
          paddingRight: 'max(0.375rem, env(safe-area-inset-right))'
        }}
      >
        {onExit && (
          <button
            type="button"
            onClick={onExit}
            title={isCanvasOnly ? 'Disconnect this pad' : 'Back to notebook'}
            aria-label={isCanvasOnly ? 'Disconnect this pad' : 'Back to notebook'}
            className={`icon-btn w-11 h-11 ${isCanvasOnly ? 'hover:text-correction' : ''}`}
          >
            {isCanvasOnly ? <Power className="w-5 h-5" /> : <ArrowLeft className="w-5 h-5" />}
          </button>
        )}

        {/* Page picker */}
        <div className="relative min-w-0">
          <button
            type="button"
            onClick={() => {
              setShowPageMenu(!showPageMenu);
              setShowBackgroundMenu(false);
            }}
            aria-expanded={showPageMenu}
            className="flex items-center gap-2.5 h-11 pl-1.5 pr-2.5 rounded-ctl hover:bg-paper-2 transition-colors text-left min-w-0 max-w-full"
          >
            <span className="w-8 h-8 shrink-0 rounded-book bg-ink text-paper flex items-center justify-center text-xs font-bold tabular-nums">
              {activePageIndex + 1}
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-ink truncate leading-tight max-w-[9.5rem] sm:max-w-[16rem]">
                {notebookTitle}
              </span>
              <span className="block text-xs text-pencil truncate leading-tight max-w-[9.5rem] sm:max-w-[16rem]">
                {activePage.title}
              </span>
            </span>
            <ChevronDown className={`w-4 h-4 shrink-0 text-pencil transition-transform ${showPageMenu ? 'rotate-180' : ''}`} />
          </button>

          {showPageMenu && (
            <div className="menu absolute top-full left-0 mt-2 w-[min(18rem,calc(100vw-1rem))] z-50">
              <div className="flex items-center justify-between px-3 pt-1 pb-2">
                <span className="text-sm font-semibold text-ink">
                  {pages.length} {pages.length === 1 ? 'page' : 'pages'}
                </span>
                {!isCanvasOnly && onCreatePage && (
                  <button
                    type="button"
                    onClick={() => {
                      onCreatePage();
                      setShowPageMenu(false);
                    }}
                    className="btn btn-sm btn-quiet"
                  >
                    <Plus className="w-4 h-4" /> New page
                  </button>
                )}
              </div>
              <div className="max-h-[50dvh] overflow-y-auto">
                {pages.map((p, idx) => (
                  <button
                    key={p.id || idx}
                    type="button"
                    onClick={() => {
                      onSelectPage?.(idx);
                      setShowPageMenu(false);
                    }}
                    className="menu-item h-11"
                  >
                    <span className="w-6 text-pencil tabular-nums text-right shrink-0">{idx + 1}</span>
                    <span className={`truncate flex-1 ${activePageIndex === idx ? 'hl px-1.5 -mx-1.5' : ''}`}>{p.title}</span>
                    {activePageIndex === idx && <Check className="w-4 h-4 shrink-0" />}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Prev / next page */}
        {pages.length > 1 && (
          <div className="hidden sm:flex items-center">
            <button
              type="button"
              disabled={activePageIndex <= 0}
              onClick={() => onSelectPage?.(activePageIndex - 1)}
              className="icon-btn w-11 h-11"
              title="Previous page"
              aria-label="Previous page"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <span className="text-sm text-pencil tabular-nums px-1 whitespace-nowrap">
              {activePageIndex + 1} of {pages.length}
            </span>
            <button
              type="button"
              disabled={activePageIndex >= pages.length - 1}
              onClick={() => onSelectPage?.(activePageIndex + 1)}
              className="icon-btn w-11 h-11"
              title="Next page"
              aria-label="Next page"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        )}

        <div className="flex-1" />

        {/* Connection status */}
        <div
          className="flex items-center gap-2 h-9 px-2.5 rounded-ctl border border-rule bg-paper-2/60 text-sm text-ink shrink-0"
          title={isCanvasOnly ? `${syncLabel}. This pad can only draw; it has no access to the account.` : syncLabel}
        >
          {syncStatus === 'offline' ? <WifiOff className="w-4 h-4 text-correction" /> : <Laptop className="w-4 h-4 text-pencil" />}
          <span className={`w-2 h-2 rounded-full shrink-0 ${syncDot}`} />
          <span className="hidden md:inline whitespace-nowrap">{syncLabel}</span>
          {isCanvasOnly && <Lock className="hidden lg:block w-3.5 h-3.5 text-pencil" />}
        </div>

        {/* Paper style */}
        <div className="relative">
          <button
            type="button"
            onClick={() => {
              setShowBackgroundMenu(!showBackgroundMenu);
              setShowPageMenu(false);
            }}
            title="Paper style"
            aria-label="Paper style"
            aria-expanded={showBackgroundMenu}
            className={`icon-btn w-11 h-11 ${showBackgroundMenu ? 'bg-paper-2 text-ink' : ''}`}
          >
            <Grid className="w-5 h-5" />
          </button>

          {showBackgroundMenu && (
            <div className="menu absolute top-full right-0 mt-2 w-44 z-50">
              {BACKGROUND_TYPES.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => {
                    setBackgroundType(b.id);
                    setShowBackgroundMenu(false);
                  }}
                  className="menu-item h-11 justify-between"
                >
                  <span className={backgroundType === b.id ? 'hl px-1.5 -mx-1.5' : ''}>{b.label}</span>
                  {backgroundType === b.id && <Check className="w-4 h-4" />}
                </button>
              ))}
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={toggleDarkMode}
          title={isDarkMode ? 'Light paper' : 'Dark paper'}
          aria-label={isDarkMode ? 'Switch to light paper' : 'Switch to dark paper'}
          className="icon-btn w-11 h-11"
        >
          {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
        </button>

        {canFullscreen && (
          <button
            type="button"
            onClick={toggleFullscreen}
            title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
            aria-label={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
            className="icon-btn w-11 h-11 hidden sm:inline-flex"
          >
            {isFullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
          </button>
        )}
      </header>

      {/* Drawing surface */}
      <div
        ref={containerRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        onPointerCancel={handlePointerUp}
        className={`relative flex-1 min-h-0 bg-paper touch-none ${
          tool === 'hand' ? 'cursor-grab active:cursor-grabbing' : tool === 'text' ? 'cursor-text' : 'cursor-crosshair'
        }`}
      >
        <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none" />
        <canvas ref={draftCanvasRef} className="absolute inset-0 pointer-events-none" />

        {/* World-space layer: keeps HTML notes in sync with the 2D canvas transform */}
        <div
          className="absolute inset-0 pointer-events-none origin-top-left overflow-visible z-10"
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

        {/* Note mode hint */}
        {tool === 'text' && (
          <div className="absolute top-16 left-3 right-3 sm:top-3 sm:right-auto sm:left-1/2 sm:-translate-x-1/2 z-20 sm:w-max max-w-md flex items-center justify-between gap-2 pl-3 pr-1 py-1 rounded-ctl hl shadow-lift pointer-events-auto">
            <span className="flex items-center gap-2 text-sm font-medium min-w-0">
              <Type className="w-4 h-4 shrink-0" />
              <span className="truncate">Tap the page to place a note</span>
            </span>
            <button
              type="button"
              onClick={() => {
                setTool('pen');
                vibrate(8);
              }}
              className="h-9 px-3 rounded-ctl text-sm font-semibold hover:bg-black/10 shrink-0"
            >
              Back to pen
            </button>
          </div>
        )}

        {/* Zoom */}
        <div className="absolute top-3 right-3 z-20 flex items-center panel p-0.5 pointer-events-auto">
          <button
            type="button"
            onClick={() => handleZoomChange(-0.1)}
            disabled={zoom <= 0.25}
            title="Zoom out"
            aria-label="Zoom out"
            className="icon-btn w-10 h-10"
          >
            <Minus className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={handleResetView}
            title="Reset to 100%"
            className="h-10 min-w-[3.25rem] px-1.5 rounded-ctl text-sm font-semibold tabular-nums text-ink hover:bg-paper-2"
          >
            {Math.round(zoom * 100)}%
          </button>
          <button
            type="button"
            onClick={() => handleZoomChange(0.1)}
            disabled={zoom >= 4.0}
            title="Zoom in"
            aria-label="Zoom in"
            className="icon-btn w-10 h-10"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

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

      {/* Tool dock: one scrollable row on phones, spread out on wide tablets */}
      <footer
        className="relative z-30 bg-paper border-t border-rule"
        style={{
          paddingBottom: 'max(0.375rem, env(safe-area-inset-bottom))',
          paddingLeft: 'env(safe-area-inset-left)',
          paddingRight: 'env(safe-area-inset-right)'
        }}
      >
        {/* Popovers live outside the scroller so they aren't clipped */}
        {showShapesMenu && (
          <div className="menu absolute bottom-full left-2 mb-2 flex items-center gap-1 z-50">
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
                  className={toolClass(tool === s.id)}
                  title={s.label}
                  aria-label={s.label}
                >
                  <Icon className="w-5 h-5" />
                </button>
              );
            })}
          </div>
        )}

        {showWidthMenu && (
          <div className="menu absolute bottom-full right-2 mb-2 p-3 w-60 z-50">
            <span className="block text-sm font-semibold text-ink mb-2">Line width</span>
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
                  className={`h-11 px-2.5 rounded-ctl text-sm font-medium flex items-center gap-2 transition-colors ${
                    strokeWidth === p.value ? 'hl' : 'bg-paper-2 text-ink hover:bg-rule/60'
                  }`}
                >
                  <span
                    className="rounded-full bg-current shrink-0"
                    style={{ width: Math.min(p.value, 12), height: Math.min(p.value, 12) }}
                  />
                  {p.label}
                </button>
              ))}
            </div>
            <input
              type="range"
              min="1"
              max="32"
              value={strokeWidth}
              onChange={(e) => setStrokeWidth(Number(e.target.value))}
              aria-label="Line width in pixels"
              className="w-full h-8 accent-[rgb(var(--ballpoint))]"
            />
          </div>
        )}

        <div className="scroll-x px-1.5 pt-1.5 [mask-image:linear-gradient(to_right,black_calc(100%-2.5rem),transparent)] lg:[mask-image:none]">
          <div className="flex items-center gap-1 w-max min-w-full pr-8 lg:pr-0 lg:justify-between">
            {/* Pen vs note */}
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={() => {
                  if (tool === 'text') setTool('pen');
                  vibrate(8);
                }}
                title="Draw"
                className={`h-11 px-3 rounded-ctl text-sm font-semibold flex items-center gap-1.5 transition-colors ${
                  tool !== 'text' ? 'bg-ink text-paper' : 'text-pencil hover:text-ink hover:bg-paper-2'
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
                title="Write a note"
                className={`h-11 px-3 rounded-ctl text-sm font-semibold flex items-center gap-1.5 transition-colors ${
                  tool === 'text' ? 'bg-ink text-paper' : 'text-pencil hover:text-ink hover:bg-paper-2'
                }`}
              >
                <Type className="w-4 h-4" />
                <span className="hidden sm:inline">Note</span>
              </button>
            </div>

            {divider}

            {/* Drawing tools */}
            <div className="flex items-center gap-0.5 shrink-0">
              <button type="button" onClick={() => { setTool('pen'); vibrate(10); }} title="Pen" aria-label="Pen" className={toolClass(tool === 'pen')}>
                <Pen className="w-5 h-5" />
              </button>
              <button type="button" onClick={() => { setTool('pencil'); vibrate(10); }} title="Pencil" aria-label="Pencil" className={toolClass(tool === 'pencil')}>
                <Pencil className="w-5 h-5" />
              </button>
              <button type="button" onClick={() => { setTool('highlighter'); vibrate(10); }} title="Highlighter" aria-label="Highlighter" className={toolClass(tool === 'highlighter')}>
                <Highlighter className="w-5 h-5" />
              </button>
              <button type="button" onClick={() => { setTool('eraser'); vibrate(10); }} title="Eraser" aria-label="Eraser" className={toolClass(tool === 'eraser')}>
                <Eraser className="w-5 h-5" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowShapesMenu(!showShapesMenu);
                  setShowWidthMenu(false);
                  vibrate(10);
                }}
                title="Shapes"
                aria-label="Shapes"
                aria-expanded={showShapesMenu}
                className={toolClass(Boolean(activeShapeTool))}
              >
                {activeShapeTool ? <activeShapeTool.icon className="w-5 h-5" /> : <Square className="w-5 h-5" />}
              </button>
              <button type="button" onClick={() => { setTool('hand'); vibrate(10); }} title="Move the page" aria-label="Move the page" className={toolClass(tool === 'hand')}>
                <Hand className="w-5 h-5" />
              </button>
              <button
                type="button"
                onClick={togglePalmRejection}
                title={palmRejection ? "Stylus only: fingers won't draw" : 'Fingers can draw. Tap for stylus only'}
                aria-label="Stylus only"
                aria-pressed={palmRejection}
                className={toolClass(palmRejection)}
              >
                <Tablet className="w-5 h-5" />
              </button>
            </div>

            {divider}

            {/* Ink colours */}
            <div className="flex items-center shrink-0">
              {palette.map((c) => (
                <button
                  key={c.hex}
                  type="button"
                  onClick={() => { setColor(c.hex); vibrate(8); }}
                  title={c.name}
                  aria-label={c.name}
                  aria-pressed={color === c.hex}
                  className="w-11 h-11 shrink-0 flex items-center justify-center rounded-ctl"
                >
                  <span
                    className={`block rounded-full transition-all ${
                      color === c.hex ? 'w-7 h-7 ring-2 ring-ink ring-offset-2 ring-offset-paper' : 'w-6 h-6 ring-1 ring-black/10'
                    }`}
                    style={{ backgroundColor: c.hex }}
                  />
                </button>
              ))}
              <label
                title="Custom colour"
                className="relative w-11 h-11 shrink-0 flex items-center justify-center rounded-ctl cursor-pointer"
              >
                <input
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  aria-label="Custom colour"
                  className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                />
                <span
                  className={`flex items-center justify-center rounded-full transition-all ${
                    isCustomColor ? 'w-7 h-7 ring-2 ring-ink ring-offset-2 ring-offset-paper' : 'w-6 h-6 border border-dashed border-pencil'
                  }`}
                  style={{ backgroundColor: isCustomColor ? color : undefined }}
                >
                  <Palette className={`w-3.5 h-3.5 pointer-events-none ${isCustomColor ? 'text-white mix-blend-difference' : 'text-pencil'}`} />
                </span>
              </label>
            </div>

            {divider}

            {/* Width */}
            <button
              type="button"
              onClick={() => {
                setShowWidthMenu(!showWidthMenu);
                setShowShapesMenu(false);
                vibrate(10);
              }}
              title="Line width"
              aria-expanded={showWidthMenu}
              className={`h-11 px-3 shrink-0 rounded-ctl flex items-center gap-2 text-sm font-semibold tabular-nums transition-colors ${
                showWidthMenu ? 'bg-paper-2 text-ink' : 'text-ink hover:bg-paper-2'
              }`}
            >
              <span
                className="rounded-full shrink-0"
                style={{ width: Math.min(Math.max(strokeWidth, 4), 14), height: Math.min(Math.max(strokeWidth, 4), 14), backgroundColor: color }}
              />
              <span>{strokeWidth}px</span>
              <ChevronDown className="w-4 h-4 text-pencil" />
            </button>

            {divider}

            {/* History */}
            <div className="flex items-center gap-0.5 shrink-0">
              <button type="button" onClick={handleUndo} disabled={undoStack.length === 0} title="Undo" aria-label="Undo" className="icon-btn w-11 h-11">
                <Undo2 className="w-5 h-5" />
              </button>
              <button type="button" onClick={handleRedo} disabled={redoStack.length === 0} title="Redo" aria-label="Redo" className="icon-btn w-11 h-11">
                <Redo2 className="w-5 h-5" />
              </button>
              <button
                type="button"
                onClick={() => { setShowClearConfirm(true); vibrate(15); }}
                title="Clear page"
                aria-label="Clear page"
                className="icon-btn w-11 h-11 hover:text-correction"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </footer>

      {/* Clear confirmation */}
      {showClearConfirm && (
        <div className="scrim" onClick={() => setShowClearConfirm(false)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="pad-clear-title"
            onClick={(e) => e.stopPropagation()}
            className="index-card sm:max-w-sm"
          >
            <div className="index-card-head">
              <h3 id="pad-clear-title" className="index-card-title">Clear this page?</h3>
            </div>
            <div className="index-card-body space-y-5" style={{ paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))' }}>
              <p className="text-sm text-pencil leading-relaxed">
                Every stroke on this page is erased here and on the paired computer. Undo won&apos;t bring it back.
              </p>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setShowClearConfirm(false)} className="btn btn-outline h-11">
                  Keep page
                </button>
                <button type="button" onClick={handleConfirmClear} className="btn btn-danger h-11">
                  Clear page
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
