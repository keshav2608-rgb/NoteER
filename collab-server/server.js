import { WebSocketServer } from 'ws';
import http from 'http';
import { authenticateCollabToken } from './auth.js';
import { roomManager } from './rooms.js';

export function setupWssListeners(wss) {
  wss.on('connection', (ws, req) => {
    ws.isAlive = true;
    ws.clientId = 'client_' + Math.random().toString(36).substring(2, 10);
    ws.authenticated = false;
    ws.room = null;

    // Heartbeat pong
    ws.on('pong', () => {
      ws.isAlive = true;
    });

    // Handle messages
    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());

        // Handshake: authenticate and join room
        if (message.type === 'auth:join') {
          const { token, roomName, isTablet } = message;
          if (!token || !roomName) {
            ws.send(JSON.stringify({ type: 'error', message: 'Missing token or roomName' }));
            return ws.close(4001, 'Unauthorized');
          }

          const decoded = authenticateCollabToken(token);
          if (!decoded) {
            ws.send(JSON.stringify({ type: 'error', message: 'Invalid or expired token' }));
            return ws.close(4003, 'Forbidden');
          }

          // Check if room belongs to token's notebook
          const parts = roomName.split(':'); // notebook:nb_123:page:pg_456
          const roomNotebookId = parts[1];
          if (decoded.notebookId !== roomNotebookId) {
            ws.send(JSON.stringify({ type: 'error', message: 'Token does not match room' }));
            return ws.close(4003, 'Forbidden');
          }

          ws.authenticated = true;
          ws.user = {
            id: decoded.userId || decoded.sub,
            name: decoded.name || 'User',
            avatar: decoded.avatar || '',
            role: decoded.role || 'viewer',
            canEdit: Boolean(decoded.canEdit)
          };
          ws.isTablet = Boolean(isTablet);

          const room = roomManager.getOrCreateRoom(roomName);
          ws.room = room;
          room.addClient(ws, ws.user, ws.isTablet);

          ws.send(JSON.stringify({
            type: 'auth:success',
            clientId: ws.clientId,
            user: ws.user,
            roomName
          }));

          console.log(`[Collab] User ${ws.user.name} (${ws.clientId}, tablet=${ws.isTablet}) joined ${roomName}`);
          return;
        }

        if (!ws.authenticated || !ws.room) {
          return ws.send(JSON.stringify({ type: 'error', message: 'Not authenticated' }));
        }

        // Live cursor & presence awareness (ephemeral)
        if (message.type === 'awareness:update') {
          ws.room.updateAwareness(ws.clientId, {
            cursor: message.cursor,
            isTablet: ws.isTablet
          });
          return;
        }

        // Collaborative operation (stroke, shape, text block)
        if (message.type === 'sync:op') {
          if (!ws.user.canEdit) {
            return ws.send(JSON.stringify({ type: 'error', message: 'Read-only access: Cannot modify notebook' }));
          }

          ws.room.applyOperation(ws.clientId, message.op);
          return;
        }

        // Ping
        if (message.type === 'ping') {
          ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
          return;
        }

      } catch (err) {
        console.error('[Collab Error] Malformed message:', err.message);
      }
    });

    ws.on('close', () => {
      if (ws.room) {
        ws.room.removeClient(ws);
        console.log(`[Collab] Client ${ws.clientId} disconnected from ${ws.room.roomName}`);
      }
    });

    ws.on('error', (err) => {
      console.error(`[Collab Socket Error] ${ws.clientId}:`, err.message);
    });
  });

  // Periodic heartbeat to detect dead connections
  const heartbeatInterval = setInterval(() => {
    wss.clients.forEach((ws) => {
      if (ws.isAlive === false) return ws.terminate();
      ws.isAlive = false;
      ws.ping();
    });
  }, 30000);

  wss.on('close', () => {
    clearInterval(heartbeatInterval);
  });
}

// Attach Collab WebSocket to an existing HTTP server (e.g. Next.js on port 3000 or custom port)
export function attachCollabWebSocket(httpServer) {
  const wss = new WebSocketServer({ noServer: true });
  setupWssListeners(wss);

  httpServer.on('upgrade', (req, socket, head) => {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname === '/collab-ws' || url.pathname.startsWith('/collab-ws')) {
      wss.handleUpgrade(req, socket, head, (ws) => {
        wss.emit('connection', ws, req);
      });
    }
  });

  return wss;
}

// Start standalone server when executed directly (e.g. `node collab-server/server.js`)
const isDirectRun = process.argv[1] && (
  process.argv[1].endsWith('collab-server/server.js') || 
  process.argv[1].endsWith('collab-server\\server.js')
);

if (isDirectRun) {
  const PORT = parseInt(process.env.COLLAB_PORT || process.env.PORT || '1234', 10);
  const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', service: 'collaborative-notebook-collab-server' }));
  });

  const wss = new WebSocketServer({ server });
  setupWssListeners(wss);

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`====================================================`);
    console.log(`🚀 Collaboration WebSocket Server listening on port ${PORT}`);
    console.log(`   Health endpoint: http://localhost:${PORT}/`);
    console.log(`   WebSocket URL: ws://localhost:${PORT}`);
    console.log(`====================================================`);
  });
}
