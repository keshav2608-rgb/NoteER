import { create } from 'zustand';

export const useNotebookStore = create((set, get) => ({
  // Active drawing & selection tool
  tool: 'select',
  setTool: (tool) => set({ tool }),

  // Styling properties
  color: '#1e293b',
  setColor: (color) => set({ color }),

  strokeWidth: 4,
  setStrokeWidth: (strokeWidth) => set({ strokeWidth }),

  opacity: 1,
  setOpacity: (opacity) => set({ opacity }),

  fillColor: 'transparent',
  setFillColor: (fillColor) => set({ fillColor }),

  // Viewport transform
  zoom: 1.0,
  panX: 0,
  panY: 0,
  setZoom: (zoom) => set({ zoom: Math.min(Math.max(zoom, 0.25), 4.0) }),
  setPan: (panX, panY) => set({ panX, panY }),
  resetView: () => set({ zoom: 1.0, panX: 0, panY: 0 }),

  // Active page & documents
  activePageId: null,
  setActivePageId: (activePageId) => set({ activePageId, undoStack: [], redoStack: [] }),

  // Realtime & Presence
  syncStatus: 'saved', // 'saved' | 'syncing' | 'offline' | 'reconnecting'
  setSyncStatus: (syncStatus) => set({ syncStatus }),

  peers: [], // Array of { clientId, user, cursor, isTablet, lastSeen }
  setPeers: (peersOrUpdater) => set((state) => {
    const nextPeers = typeof peersOrUpdater === 'function'
      ? peersOrUpdater(Array.isArray(state.peers) ? state.peers : [])
      : peersOrUpdater;
    return { peers: Array.isArray(nextPeers) ? nextPeers : [] };
  }),

  tabletConnected: false,
  setTabletConnected: (tabletConnected) => set({ tabletConnected }),

  canEdit: true,
  setCanEdit: (canEdit) => set({ canEdit }),

  darkMode: false,
  setDarkMode: (darkMode) => set({ darkMode }),
  toggleDarkMode: () => set((state) => {
    const next = !state.darkMode;
    const nextColor = next && (state.color === '#1e293b' || state.color === '#0f172a')
      ? '#f8fafc'
      : (!next && (state.color === '#f8fafc' || state.color === '#ffffff') ? '#1e293b' : state.color);
    return { darkMode: next, color: nextColor };
  }),

  // Undo / Redo history for local user actions
  undoStack: [],
  redoStack: [],
  pushUndo: (op) => set((state) => ({
    undoStack: [...state.undoStack.slice(-50), op],
    redoStack: []
  })),
  popUndo: () => {
    const { undoStack, redoStack } = get();
    if (undoStack.length === 0) return null;
    const lastOp = undoStack[undoStack.length - 1];
    set({
      undoStack: undoStack.slice(0, -1),
      redoStack: [...redoStack, lastOp]
    });
    return lastOp;
  },
  popRedo: () => {
    const { undoStack, redoStack } = get();
    if (redoStack.length === 0) return null;
    const lastOp = redoStack[redoStack.length - 1];
    set({
      redoStack: redoStack.slice(0, -1),
      undoStack: [...undoStack, lastOp]
    });
    return lastOp;
  }
}));
