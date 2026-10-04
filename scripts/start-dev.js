import { spawn } from 'child_process';
import path from 'path';
import { getLanIpAddress } from '../lib/network.js';

console.log('✨ Starting Collaborative Notebook Development Environment...\n');
const lanIp = getLanIpAddress();
console.log(`💻 Local Laptop:  http://localhost:3000`);
if (lanIp) {
  console.log(`📱 Tablet / LAN:  http://${lanIp}:3000`);
}
console.log(`⚡ Collab Server: ws://${lanIp || 'localhost'}:1234\n`);

// 1. Start Collab WebSocket server
const collabProcess = spawn('node', ['collab-server/server.js'], {
  stdio: 'inherit',
  shell: true,
  env: { ...process.env, PORT: '3000', COLLAB_PORT: '1234' }
});

// 2. Start Next.js App
const nextProcess = spawn('npx', ['next', 'dev', '-H', '0.0.0.0', '-p', '3000'], {
  stdio: 'inherit',
  shell: true,
  env: { ...process.env, PORT: '3000', COLLAB_PORT: '1234' }
});

process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down development servers...');
  collabProcess.kill();
  nextProcess.kill();
  process.exit(0);
});

process.on('SIGTERM', () => {
  collabProcess.kill();
  nextProcess.kill();
  process.exit(0);
});
