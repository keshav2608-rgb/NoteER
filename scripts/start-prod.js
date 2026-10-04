import { spawn } from 'child_process';
import { getLanIpAddress } from '../lib/network.js';

console.log('🚀 Starting Collaborative Notebook Production Environment...\n');
const lanIp = getLanIpAddress();
const port = process.env.PORT || '3000';
const collabPort = process.env.COLLAB_PORT || '1234';

console.log(`💻 Local:       http://localhost:${port}`);
if (lanIp) {
  console.log(`📱 LAN/Tablet:  http://${lanIp}:${port}`);
}
console.log(`⚡ Collab WS:   ws://${lanIp || 'localhost'}:${collabPort}\n`);

// 1. Start Collab WebSocket server
const collabProcess = spawn('node', ['collab-server/server.js'], {
  stdio: 'inherit',
  shell: true,
  env: { ...process.env, PORT: port, COLLAB_PORT: collabPort, NODE_ENV: 'production' }
});

// 2. Start Next.js App
const nextProcess = spawn('npx', ['next', 'start', '-H', '0.0.0.0', '-p', port], {
  stdio: 'inherit',
  shell: true,
  env: { ...process.env, PORT: port, COLLAB_PORT: collabPort, NODE_ENV: 'production' }
});

const cleanup = () => {
  console.log('\n🛑 Shutting down production servers...');
  try { collabProcess.kill(); } catch (_) {}
  try { nextProcess.kill(); } catch (_) {}
  process.exit(0);
};

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
