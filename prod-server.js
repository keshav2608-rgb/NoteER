import http from 'http';
import { EventEmitter } from 'events';
import next from 'next';
import { attachCollabWebSocket } from './collab-server/server.js';
import { getLanIpAddress } from './lib/network.js';

const dev = false;
const port = parseInt(process.env.PORT || '3000', 10);
// Next.js lazily attaches its own 'upgrade' listener to the request's server,
// which would also grab /collab-ws upgrades and corrupt the WebSocket stream.
// Hand it an inert emitter instead and route upgrades explicitly below.
const app = next({ dev, dir: process.cwd(), httpServer: new EventEmitter() });
const handle = app.getRequestHandler();
const handleNextUpgrade = app.getUpgradeHandler();

console.log('✨ Initializing Collaborative Notebook Unified Production Server...');

app.prepare().then(() => {
  const server = http.createServer((req, res) => {
    handle(req, res);
  });

  // Attach Collab WebSocket handler to /collab-ws on the same HTTP server
  attachCollabWebSocket(server);

  // Forward all other upgrade requests to Next.js
  server.on('upgrade', (req, socket, head) => {
    const { pathname } = new URL(req.url, 'http://localhost');
    if (!pathname.startsWith('/collab-ws')) {
      handleNextUpgrade(req, socket, head);
    }
  });

  server.listen(port, '0.0.0.0', () => {
    const lanIp = getLanIpAddress();
    console.log('====================================================');
    console.log(`🚀 Unified App & Collab Server running on port ${port}`);
    console.log(`   Web App:       http://localhost:${port}`);
    if (lanIp) {
      console.log(`   LAN / Tablet:  http://${lanIp}:${port}`);
    }
    console.log(`   Collab WS:     ws://localhost:${port}/collab-ws`);
    console.log('====================================================');
  });
}).catch((err) => {
  console.error('Server startup error:', err);
  process.exit(1);
});
