import { WebSocket } from 'ws';
import { spawn } from 'child_process';
import assert from 'assert';
import db from '../lib/db/index.js';
import { generateCollabToken } from '../lib/auth/permissions.js';

console.log('🧪 Testing Unified Production Server (Single Port Next.js + /collab-ws)...');

const TEST_PORT = 3456;
const proc = spawn('node', ['prod-server.js'], {
  env: { ...process.env, PORT: String(TEST_PORT), NODE_ENV: 'production' },
  stdio: 'pipe'
});

let serverReady = false;

proc.stdout.on('data', (d) => {
  const text = d.toString();
  if (text.includes('Unified App & Collab Server running on port')) {
    serverReady = true;
  }
});

proc.stderr.on('data', (d) => {
  console.error('stderr:', d.toString());
});

async function run() {
  try {
    // Wait for server to start
    for (let i = 0; i < 30; i++) {
      if (serverReady) break;
      await new Promise(r => setTimeout(r, 400));
    }
    assert(serverReady, 'Production server failed to start within timeout');

    // 1. Test HTTP request on TEST_PORT
    const httpRes = await fetch(`http://localhost:${TEST_PORT}/api/auth/me`);
    assert.strictEqual(httpRes.status, 200, 'HTTP response should be 200');
    console.log('  ✓ HTTP request succeeded on port', TEST_PORT);

    // 2. Test WebSocket handshake on http://localhost:TEST_PORT/collab-ws
    const owner = db.get('SELECT * FROM users WHERE id = ?', ['usr_demo_owner']);
    const token = generateCollabToken(owner, 'nb_starter_welcome', 'page_overview');

    const ws = new WebSocket(`ws://localhost:${TEST_PORT}/collab-ws`);
    await new Promise((resolve, reject) => {
      ws.on('open', () => {
        ws.send(JSON.stringify({
          type: 'auth:join',
          token,
          roomName: 'notebook:nb_starter_welcome:page:page_overview',
          isTablet: false
        }));
      });

      ws.on('message', (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'auth:success') {
          console.log('  ✓ WebSocket connected and authenticated on /collab-ws on same port', TEST_PORT);
          ws.close();
          resolve();
        }
      });

      ws.on('error', reject);
      setTimeout(() => reject(new Error('WebSocket connection timed out')), 5000);
    });

    console.log('🎉 Unified Single-Port Production Server Verified Successfully!');
  } finally {
    proc.kill();
  }
}

run().catch((err) => {
  console.error('Test failed:', err);
  proc.kill();
  process.exit(1);
});
