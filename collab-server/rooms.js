import { loadRoomState, saveRoomState } from './persistence.js';

class Room {
  constructor(roomName) {
    this.roomName = roomName;
    this.clients = new Set();
    this.awareness = new Map(); // clientId -> { user, cursor, isTablet, lastSeen }
    this.documentState = {
      strokes: [],
      shapes: [],
      textBlocks: []
    };
    this.saveTimeout = null;
    this.dirty = false;
    this.saving = null;
    this.loaded = false;
    this.ready = this.load();
  }

  // Load persisted state. If the database is unreachable the room refuses to open
  // (rather than starting empty and later overwriting real drawings with a blank canvas).
  async load() {
    const result = await loadRoomState(this.roomName);
    if (!result.ok) {
      throw new Error(`Database unavailable while loading ${this.roomName}`);
    }
    if (result.state) {
      try {
        const parsed = JSON.parse(result.state);
        this.documentState = {
          strokes: parsed.strokes || [],
          shapes: parsed.shapes || [],
          textBlocks: Array.isArray(parsed.textBlocks) ? parsed.textBlocks.filter(t => !t.deleted) : []
        };
      } catch (err) {
        // Corrupt snapshot: do not start empty and overwrite it.
        throw new Error(`Failed to parse persisted state for ${this.roomName}: ${err.message}`);
      }
    }
    this.loaded = true;
  }

  scheduleSave() {
    this.dirty = true;
    if (this.saveTimeout) clearTimeout(this.saveTimeout);
    this.saveTimeout = setTimeout(() => {
      this.saveTimeout = null;
      this.flush();
    }, 500);
  }

  // Persist now. Serialized so saves never interleave; on failure the room stays dirty
  // and is retried, so a temporary DB outage does not lose drawings held in memory.
  flush() {
    if (this.saving) return this.saving;
    this.saving = (async () => {
      try {
        while (this.dirty && this.loaded) {
          this.dirty = false;
          const ok = await saveRoomState(this.roomName, JSON.stringify(this.documentState));
          if (!ok) {
            this.dirty = true;
            if (!this.saveTimeout) {
              this.saveTimeout = setTimeout(() => {
                this.saveTimeout = null;
                this.flush();
              }, 5000);
            }
            break;
          }
        }
      } finally {
        this.saving = null;
      }
    })();
    return this.saving;
  }

  addClient(ws, user, isTablet = false) {
    this.clients.add(ws);
    const clientId = ws.clientId;
    this.awareness.set(clientId, {
      clientId,
      user,
      cursor: null,
      isTablet,
      lastSeen: Date.now()
    });

    // Send initial full sync to this client
    ws.send(JSON.stringify({
      type: 'sync:init',
      roomName: this.roomName,
      documentState: this.documentState,
      awareness: Array.from(this.awareness.values())
    }));

    // Broadcast user join to others
    this.broadcastAwareness();
    this.checkDesktopStatus();
  }

  removeClient(ws) {
    this.clients.delete(ws);
    this.awareness.delete(ws.clientId);
    this.broadcastAwareness();
    this.checkDesktopStatus();
    if (this.clients.size === 0) {
      // Last client left: persist immediately instead of waiting for the debounce
      if (this.saveTimeout) {
        clearTimeout(this.saveTimeout);
        this.saveTimeout = null;
      }
      this.flush();
    }
  }

  checkDesktopStatus() {
    const hasDesktop = Array.from(this.clients).some(c => !c.isTablet);
    const msg = JSON.stringify({
      type: 'host:status',
      hostActive: hasDesktop
    });
    for (const client of this.clients) {
      if (client.isTablet && client.readyState === 1) {
        client.send(msg);
      }
    }
  }

  updateAwareness(clientId, cursorData) {
    const entry = this.awareness.get(clientId);
    if (entry) {
      entry.cursor = cursorData.cursor;
      entry.isTablet = Boolean(cursorData.isTablet);
      entry.lastSeen = Date.now();
      
      // Ephemeral broadcast to other clients in room (never persists to DB!)
      this.broadcastToOthers(clientId, {
        type: 'awareness:update',
        clientId,
        cursor: entry.cursor,
        isTablet: entry.isTablet,
        user: entry.user
      });
    }
  }

  applyOperation(clientId, op) {
    // Operation types:
    // stroke:add, stroke:erase, shape:add, shape:update, shape:delete, text:update, state:reset
    let changed = false;

    if (op.type === 'stroke:add' && op.stroke) {
      this.documentState.strokes.push(op.stroke);
      changed = true;
    } else if (op.type === 'stroke:erase' && op.strokeId) {
      this.documentState.strokes = this.documentState.strokes.filter(s => s.id !== op.strokeId);
      changed = true;
    } else if (op.type === 'stroke:clear' || op.type === 'canvas:clear') {
      this.documentState.strokes = [];
      this.documentState.shapes = [];
      this.documentState.textBlocks = [];
      changed = true;
    } else if (op.type === 'shape:add' && op.shape) {
      this.documentState.shapes.push(op.shape);
      changed = true;
    } else if (op.type === 'shape:update' && op.shape) {
      const idx = this.documentState.shapes.findIndex(s => s.id === op.shape.id);
      if (idx >= 0) {
        this.documentState.shapes[idx] = op.shape;
      } else {
        this.documentState.shapes.push(op.shape);
      }
      changed = true;
    } else if (op.type === 'shape:delete' && op.shapeId) {
      this.documentState.shapes = this.documentState.shapes.filter(s => s.id !== op.shapeId);
      changed = true;
    } else if (op.type === 'text:update' && op.textBlock) {
      if (op.textBlock.deleted) {
        this.documentState.textBlocks = this.documentState.textBlocks.filter(t => t.id !== op.textBlock.id);
      } else {
        const idx = this.documentState.textBlocks.findIndex(t => t.id === op.textBlock.id);
        if (idx >= 0) {
          this.documentState.textBlocks[idx] = op.textBlock;
        } else {
          this.documentState.textBlocks.push(op.textBlock);
        }
      }
      changed = true;
    } else if (op.type === 'text:delete') {
      const delId = op.textBlockId || op.textBlock?.id;
      if (delId) {
        this.documentState.textBlocks = this.documentState.textBlocks.filter(t => t.id !== delId);
        changed = true;
      }
    } else if (op.type === 'state:restore' && op.documentState) {
      this.documentState = {
        strokes: op.documentState.strokes || [],
        shapes: op.documentState.shapes || [],
        textBlocks: Array.isArray(op.documentState.textBlocks) ? op.documentState.textBlocks.filter(t => !t.deleted) : []
      };
      changed = true;
    }

    if (changed) {
      // Broadcast operation immediately to all other clients for low-latency live rendering
      this.broadcastToOthers(clientId, {
        type: 'sync:op',
        op,
        clientId
      });

      // Debounced durable save (sampling/batching persistence)
      this.scheduleSave();
    }
  }

  broadcastAwareness() {
    const awarenessList = Array.from(this.awareness.values());
    const msg = JSON.stringify({
      type: 'awareness:list',
      awareness: awarenessList
    });
    for (const client of this.clients) {
      if (client.readyState === 1) {
        client.send(msg);
      }
    }
  }

  broadcastToOthers(senderClientId, payload) {
    const msg = JSON.stringify(payload);
    for (const client of this.clients) {
      if (client.clientId !== senderClientId && client.readyState === 1) {
        client.send(msg);
      }
    }
  }
}

class RoomManager {
  constructor() {
    this.rooms = new Map();
  }

  // Resolves once the room's persisted state is loaded. Rejects (and forgets the room)
  // if the database is unavailable so the next join retries the load.
  async getOrCreateRoom(roomName) {
    let room = this.rooms.get(roomName);
    if (!room) {
      room = new Room(roomName);
      this.rooms.set(roomName, room);
    }
    try {
      await room.ready;
    } catch (err) {
      if (this.rooms.get(roomName) === room) this.rooms.delete(roomName);
      throw err;
    }
    return room;
  }

  async cleanupEmptyRooms() {
    for (const [name, room] of this.rooms.entries()) {
      if (room.clients.size === 0) {
        await room.flush();
        if (!room.dirty && room.clients.size === 0) this.rooms.delete(name);
      }
    }
  }

  // Flush every dirty room (used on shutdown so SIGTERM from a redeploy doesn't drop the last 500ms)
  async flushAll() {
    await Promise.all(Array.from(this.rooms.values()).map((room) => room.flush()));
  }
}

export const roomManager = new RoomManager();
