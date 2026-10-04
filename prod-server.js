import http from 'http';
import next from 'next';
import { attachCollabWebSocket } from './collab-server/server.js';
import { getLanIpAddress } from './lib/network.js';

const dev = false;
const port = parseInt(process.env.PORT || '3000', 10);
const app = next({ dev, dir: process.cwd() });
const handle = app.getRequestHandler();

console.log('✨ Initializing Collaborative Notebook Unified Production Server...');

app.prepare().then(() => {
  const server = http.createServer((req, res) => {
    handle(req, res);
  });

  // Attach Collab WebSocket handler to /collab-ws on the same HTTP server
  attachCollabWebSocket(server);

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
