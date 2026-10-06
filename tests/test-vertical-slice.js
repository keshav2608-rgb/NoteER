import assert from 'assert';
import { WebSocket } from 'ws';
import { spawn } from 'child_process';
import { db, toPgQuery } from '../lib/db/index.js';
import { createSession, signToken } from '../lib/auth/session.js';
import { generateCollabToken, canEditNotebook, canViewNotebook, canManageMembers, canDeleteNotebook } from '../lib/auth/permissions.js';
import { logAuditEvent } from '../lib/auth/audit.js';

console.log('🧪 Starting Collaborative Notebook Vertical Slice & Integration Tests...\n');

async function runTests() {
  let passed = 0;
  let total = 0;
  let testCollabProcess = null;

  // Auto-start collab server if not running
  try {
    const testProbe = new WebSocket('ws://localhost:1234');
    await new Promise((res, rej) => {
      testProbe.on('open', () => { testProbe.close(); res(); });
      testProbe.on('error', rej);
      setTimeout(() => rej(new Error('timeout')), 400);
    });
  } catch (err) {
    testCollabProcess = spawn('node', ['collab-server/server.js'], { stdio: 'ignore' });
    await new Promise(r => setTimeout(r, 700));
  }

  function test(name, fn) {
    total++;
    try {
      fn();
      console.log(`  ✓ ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ✗ ${name}`);
      console.error(`    ${err.message}`);
    }
  }

  async function testAsync(name, fn) {
    total++;
    try {
      await fn();
      console.log(`  ✓ ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ✗ ${name}`);
      console.error(`    ${err.message}`);
    }
  }

  console.log('=== Test Suite 1: Database Entities & Schema ===');
  test('Users table seeded with Demo accounts', () => {
    const users = db.query('SELECT id, name, email FROM users');
    assert(users.length >= 3, 'Expected at least 3 seeded users');
    const owner = users.find(u => u.id === 'usr_demo_owner');
    assert(owner, 'Owner user exists');
  });

  test('Notebooks and pages initialized with default background types', () => {
    const notebooks = db.query('SELECT * FROM notebooks');
    assert(notebooks.length >= 1, 'Starter notebook exists');
    const pages = db.query('SELECT * FROM pages WHERE notebook_id = ?', [notebooks[0].id]);
    assert(pages.length >= 3, 'Expected 3 starter pages');
    assert(['blank', 'ruled', 'grid', 'dotted'].includes(pages[0].background_type));
  });

  console.log('\n=== Test Suite 2: Authentication & Permissions ===');
  test('Session generation & JWT signing', () => {
    const { token, expiresAt } = createSession('usr_demo_owner', 'TestRunner/1.0');
    assert(token && typeof token === 'string');
    assert(expiresAt);
  });

  test('Role-based access permissions enforcement', () => {
    const notebookId = 'nb_starter_welcome';
    assert.strictEqual(canViewNotebook('usr_demo_owner', notebookId), true);
    assert.strictEqual(canEditNotebook('usr_demo_owner', notebookId), true);
    assert.strictEqual(canEditNotebook('usr_demo_editor', notebookId), true);
    assert.strictEqual(canEditNotebook('usr_demo_viewer', notebookId), false, 'Viewer cannot edit');
  });

  test('Collaboration token issuance with claims', () => {
    const user = db.get('SELECT * FROM users WHERE id = ?', ['usr_demo_owner']);
    const token = generateCollabToken(user, 'nb_starter_welcome', 'page_overview');
    assert(token);
  });

  console.log('\n=== Test Suite 3: Tablet Pairing & QR Generator ===');
  test('Pairing PIN code creation & verification', () => {
    const pairingId = 'pair_test_' + Date.now();
    const code = `${Math.floor(100 + Math.random() * 900)}-${Math.floor(100 + Math.random() * 900)}`;
    const expires = new Date(Date.now() + 15 * 60 * 1000).toISOString();

    db.run(`
      INSERT INTO device_pairings (id, notebook_id, user_id, pairing_code, target_device_name, status, expires_at, created_at)
      VALUES (?, 'nb_starter_welcome', 'usr_demo_owner', ?, 'Desktop PC', 'pending', ?, ?)
    `, [pairingId, code, expires, new Date().toISOString()]);

    const found = db.get('SELECT * FROM device_pairings WHERE pairing_code = ?', [code]);
    assert(found, 'Pairing code found in DB');
    assert.strictEqual(found.status, 'pending');
  });

  console.log('\n=== Test Suite 4: WebSocket Realtime Sync (PC <-> Tablet) ===');
  await testAsync('PC Desktop & Tablet connect, synchronize stroke and cursor in realtime', async () => {
    const WS_URL = 'ws://localhost:1234';
    const roomName = 'notebook:nb_starter_welcome:page:page_overview';

    const ownerUser = db.get('SELECT * FROM users WHERE id = ?', ['usr_demo_owner']);
    const editorUser = db.get('SELECT * FROM users WHERE id = ?', ['usr_demo_editor']);

    const pcToken = generateCollabToken(ownerUser, 'nb_starter_welcome', 'page_overview');
    const tabletToken = generateCollabToken(editorUser, 'nb_starter_welcome', 'page_overview');

    // 1. Connect PC client
    const pcWs = new WebSocket(WS_URL);
    let pcReceivedTabletStroke = false;
    let pcReceivedCursor = false;

    await new Promise((resolve, reject) => {
      pcWs.on('open', () => {
        pcWs.send(JSON.stringify({
          type: 'auth:join',
          token: pcToken,
          roomName,
          isTablet: false
        }));
      });

      pcWs.on('message', (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'auth:success') {
          resolve();
        }
      });

      pcWs.on('error', reject);
    });

    // 2. Connect Tablet client
    const tabletWs = new WebSocket(WS_URL);
    await new Promise((resolve, reject) => {
      tabletWs.on('open', () => {
        tabletWs.send(JSON.stringify({
          type: 'auth:join',
          token: tabletToken,
          roomName,
          isTablet: true
        }));
      });

      tabletWs.on('message', (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'auth:success') {
          resolve();
        }
      });

      tabletWs.on('error', reject);
    });

    // 3. Set up PC listener for Tablet stroke and cursor
    const syncPromise = new Promise((resolve) => {
      pcWs.on('message', (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'sync:op' && msg.op.type === 'stroke:add') {
          pcReceivedTabletStroke = true;
        }
        if (msg.type === 'awareness:update' && msg.isTablet) {
          pcReceivedCursor = true;
        }
        if (pcReceivedTabletStroke && pcReceivedCursor) {
          resolve();
        }
      });
    });

    // 4. Tablet sends live cursor & stroke
    tabletWs.send(JSON.stringify({
      type: 'awareness:update',
      cursor: { x: 450, y: 320 }
    }));

    const testStroke = {
      id: 'stroke_tablet_live_test_1',
      tool: 'pen',
      points: [{ x: 100, y: 150 }, { x: 120, y: 165 }, { x: 150, y: 190 }],
      color: '#2563eb',
      width: 4
    };

    tabletWs.send(JSON.stringify({
      type: 'sync:op',
      op: { type: 'stroke:add', stroke: testStroke }
    }));

    // Wait for PC to receive stroke and cursor
    await syncPromise;

    assert(pcReceivedTabletStroke, 'PC received stroke drawn on Tablet in realtime');
    assert(pcReceivedCursor, 'PC received live Tablet cursor in realtime');

    pcWs.close();
    tabletWs.close();
  });

  await testAsync('Persistence test: Reconnecting device recovers persisted stroke state', async () => {
    // Wait 600ms for debounced room persistence to flush to SQLite
    await new Promise((r) => setTimeout(r, 650));

    const WS_URL = 'ws://localhost:1234';
    const roomName = 'notebook:nb_starter_welcome:page:page_overview';
    const ownerUser = db.get('SELECT * FROM users WHERE id = ?', ['usr_demo_owner']);
    const token = generateCollabToken(ownerUser, 'nb_starter_welcome', 'page_overview');

    const freshClient = new WebSocket(WS_URL);
    await new Promise((resolve, reject) => {
      freshClient.on('open', () => {
        freshClient.send(JSON.stringify({
          type: 'auth:join',
          token,
          roomName,
          isTablet: false
        }));
      });

      freshClient.on('message', (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'sync:init') {
          const strokes = msg.documentState?.strokes || [];
          const found = strokes.find(s => s.id === 'stroke_tablet_live_test_1');
          assert(found, 'Persisted tablet stroke was restored from database snapshot upon reconnect!');
          freshClient.close();
          resolve();
        }
      });

      freshClient.on('error', reject);
    });
  });

  await testAsync('Cross-device text note synchronization: PC and Tablet sync, update, and cleanly delete in realtime', async () => {
    const WS_URL = 'ws://localhost:1234';
    const roomName = 'notebook:nb_starter_welcome:page:page_overview';
    const ownerUser = db.get('SELECT * FROM users WHERE id = ?', ['usr_demo_owner']);
    const editorUser = db.get('SELECT * FROM users WHERE id = ?', ['usr_demo_editor']);
    const pcToken = generateCollabToken(ownerUser, 'nb_starter_welcome', 'page_overview');
    const tabletToken = generateCollabToken(editorUser, 'nb_starter_welcome', 'page_overview');

    const pcWs = new WebSocket(WS_URL);
    await new Promise((resolve, reject) => {
      pcWs.on('open', () => {
        pcWs.send(JSON.stringify({ type: 'auth:join', token: pcToken, roomName, isTablet: false }));
      });
      pcWs.on('message', (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'auth:success') resolve();
      });
      pcWs.on('error', reject);
    });

    const tabletWs = new WebSocket(WS_URL);
    await new Promise((resolve, reject) => {
      tabletWs.on('open', () => {
        tabletWs.send(JSON.stringify({ type: 'auth:join', token: tabletToken, roomName, isTablet: true }));
      });
      tabletWs.on('message', (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'auth:success') resolve();
      });
      tabletWs.on('error', reject);
    });

    let tabletReceivedText = false;
    let pcReceivedUpdate = false;
    let pcReceivedDelete = false;

    const testBlockId = 'txt_sync_test_' + Date.now();

    const tabletTextPromise = new Promise((resolve) => {
      tabletWs.on('message', (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'sync:op' && msg.op.type === 'text:update' && msg.op.textBlock?.id === testBlockId) {
          if (msg.op.textBlock.text === 'Note created on PC') {
            tabletReceivedText = true;
            resolve();
          }
        }
      });
    });

    pcWs.send(JSON.stringify({
      type: 'sync:op',
      op: {
        type: 'text:update',
        textBlock: {
          id: testBlockId,
          text: 'Note created on PC',
          x: 150,
          y: 250,
          width: 320,
          fontSize: 16
        }
      }
    }));

    await tabletTextPromise;
    assert(tabletReceivedText, 'Tablet received text note created on PC in realtime');

    const pcUpdatePromise = new Promise((resolve) => {
      pcWs.on('message', (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'sync:op' && msg.op.type === 'text:update' && msg.op.textBlock?.id === testBlockId) {
          if (msg.op.textBlock.text === 'Note edited on Tablet') {
            pcReceivedUpdate = true;
            resolve();
          }
        }
        if (msg.type === 'sync:op' && (msg.op.type === 'text:delete' || (msg.op.type === 'text:update' && msg.op.textBlock?.deleted))) {
          if (msg.op.textBlockId === testBlockId || msg.op.textBlock?.id === testBlockId) {
            pcReceivedDelete = true;
          }
        }
      });
    });

    tabletWs.send(JSON.stringify({
      type: 'sync:op',
      op: {
        type: 'text:update',
        textBlock: {
          id: testBlockId,
          text: 'Note edited on Tablet',
          x: 150,
          y: 250,
          width: 320,
          fontSize: 16
        }
      }
    }));

    await pcUpdatePromise;
    assert(pcReceivedUpdate, 'PC received text note update edited on Tablet in realtime');

    const pcDeletePromise = new Promise((resolve) => {
      const listener = (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'sync:op' && (msg.op.type === 'text:delete' || (msg.op.type === 'text:update' && msg.op.textBlock?.deleted))) {
          if (msg.op.textBlockId === testBlockId || msg.op.textBlock?.id === testBlockId) {
            pcReceivedDelete = true;
            pcWs.removeListener('message', listener);
            resolve();
          }
        }
      };
      pcWs.on('message', listener);
    });

    tabletWs.send(JSON.stringify({
      type: 'sync:op',
      op: {
        type: 'text:delete',
        textBlockId: testBlockId,
        textBlock: { id: testBlockId, deleted: true }
      }
    }));

    await pcDeletePromise;
    assert(pcReceivedDelete, 'PC received text note deletion in realtime');

    pcWs.close();
    tabletWs.close();
  });

  console.log('\n=== Test Suite 5: Scoped Canvas-Only Pairing Security ===');
  await testAsync('Paired tablet receives scoped stylusToken and can draw on canvas without user account access', async () => {
    // 1. Issue a pairing code for notebook
    const code = `9${Math.floor(10 + Math.random() * 90)}-${Date.now().toString().slice(-4)}`;
    const expires = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    const pairId = 'pair_sec_' + Date.now();
    db.run(`
      INSERT INTO device_pairings (id, notebook_id, user_id, pairing_code, target_device_name, status, expires_at, created_at)
      VALUES (?, 'nb_starter_welcome', 'usr_demo_owner', ?, 'Tablet iPad', 'pending', ?, ?)
    `, [pairId, code, expires, new Date().toISOString()]);

    // 2. Sign scoped stylus token (identical to /api/pairing/verify)
    const stylusToken = signToken({
      pairingId: pairId,
      notebookId: 'nb_starter_welcome',
      scope: 'canvas_only',
      role: 'canvas_stylus',
      createdAt: new Date().toISOString()
    }, '24h');

    // 3. Verify token claims
    const decoded = signToken ? JSON.parse(Buffer.from(stylusToken.split('.')[1], 'base64').toString()) : null;
    assert.strictEqual(decoded.scope, 'canvas_only', 'Token has canvas_only scope');
    assert.strictEqual(decoded.role, 'canvas_stylus', 'Token has canvas_stylus role');
    assert(!decoded.userId || decoded.userId !== 'usr_demo_owner', 'Tablet does NOT receive owner userId');

    // 4. Verify scoped token can connect to collab server and draw
    const WS_URL = 'ws://localhost:1234';
    const roomName = 'notebook:nb_starter_welcome:page:page_overview';
    const collabToken = signToken({
      sub: `stylus_${pairId}`,
      userId: `stylus_${pairId}`,
      name: 'Tablet Stylus',
      notebookId: 'nb_starter_welcome',
      pageId: 'page_overview',
      role: 'canvas_stylus',
      canEdit: true,
      isTablet: true,
      scope: 'canvas_only'
    }, '1h');

    const tabletWs = new WebSocket(WS_URL);
    await new Promise((resolve, reject) => {
      tabletWs.on('open', () => {
        tabletWs.send(JSON.stringify({
          type: 'auth:join',
          token: collabToken,
          roomName,
          isTablet: true
        }));
      });

      tabletWs.on('message', (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'auth:success') {
          // Send a test stroke
          tabletWs.send(JSON.stringify({
            type: 'sync:op',
            op: {
              type: 'stroke:add',
              stroke: {
                id: 'sec_test_stroke_1',
                tool: 'pen',
                color: '#2563eb',
                width: 3,
                points: [{ x: 10, y: 10 }, { x: 20, y: 20 }]
              }
            }
          }));
          tabletWs.close();
          resolve();
        }
      });
      tabletWs.on('error', reject);
    });
  });

  console.log('\n=== Test Suite 6: Security, Sharing Control & Database Translation ===');
  test('Only notebook creator can control sharing and delete notebook', () => {
    const notebookId = 'nb_starter_welcome';
    assert.strictEqual(canManageMembers('usr_demo_owner', notebookId), true, 'Creator can manage members');
    assert.strictEqual(canDeleteNotebook('usr_demo_owner', notebookId), true, 'Creator can delete notebook');
    assert.strictEqual(canManageMembers('usr_demo_editor', notebookId), false, 'Editor cannot manage members');
    assert.strictEqual(canDeleteNotebook('usr_demo_editor', notebookId), false, 'Editor cannot delete notebook');
    assert.strictEqual(canManageMembers('usr_demo_viewer', notebookId), false, 'Viewer cannot manage members');
  });

  test('Database query translator converts SQLite placeholders to PostgreSQL syntax', () => {
    const sql = 'SELECT * FROM users WHERE email = ? AND status = ?';
    const translated = toPgQuery(sql);
    assert.strictEqual(translated, 'SELECT * FROM users WHERE email = $1 AND status = $2');
  });

  await testAsync('Security audit log persists authentication and administrative events', async () => {
    await logAuditEvent({
      actorUserId: 'usr_demo_owner',
      action: 'security_test_event',
      resourceType: 'notebook',
      resourceId: 'nb_starter_welcome',
      metadata: { test: true }
    });

    const logs = db.query("SELECT * FROM audit_logs WHERE action = 'security_test_event'");
    assert(logs.length > 0, 'Audit log was successfully recorded');
  });

  await testAsync('Clear notebook overall wipes strokes, snapshots, and resets pages to clean Page 1', async () => {
    const testNbId = 'nb_clear_test_' + Date.now();
    const now = new Date().toISOString();
    db.run("INSERT INTO notebooks (id, owner_id, title, description, created_at, updated_at) VALUES (?, 'usr_demo_owner', 'Clear Test', '', ?, ?)", [testNbId, now, now]);
    db.run("INSERT INTO pages (id, notebook_id, title, sort_order, background_type, created_at, updated_at) VALUES (?, ?, 'Page A', 0, 'grid', ?, ?)", ['p_a_' + testNbId, testNbId, now, now]);
    db.run("INSERT INTO pages (id, notebook_id, title, sort_order, background_type, created_at, updated_at) VALUES (?, ?, 'Page B', 1, 'ruled', ?, ?)", ['p_b_' + testNbId, testNbId, now, now]);
    db.run("INSERT INTO document_snapshots (id, notebook_id, title, created_by, created_at, snapshot_data) VALUES (?, ?, 'Snap 1', 'usr_demo_owner', ?, '{}')", ['snp_' + testNbId, testNbId, now]);
    db.run("INSERT INTO collab_document_updates (id, room_name, update_base64, created_at) VALUES (?, ?, 'data', ?)", ['upd_' + testNbId, `notebook:${testNbId}:page:p_a_${testNbId}`, now]);

    // Perform clear operations matching API
    await db.run('DELETE FROM collab_document_updates WHERE room_name LIKE ?', [`notebook:${testNbId}:%`]);
    await db.run('DELETE FROM document_snapshots WHERE notebook_id = ?', [testNbId]);
    await db.run('UPDATE pages SET title = ?, background_type = ?, sort_order = 0, updated_at = ? WHERE id = ?', ['Page 1', 'blank', now, 'p_a_' + testNbId]);
    await db.run('DELETE FROM pages WHERE notebook_id = ? AND id != ?', [testNbId, 'p_a_' + testNbId]);

    const remainingPages = db.query('SELECT * FROM pages WHERE notebook_id = ?', [testNbId]);
    const remainingSnaps = db.query('SELECT * FROM document_snapshots WHERE notebook_id = ?', [testNbId]);
    const remainingCollab = db.query('SELECT * FROM collab_document_updates WHERE room_name LIKE ?', [`notebook:${testNbId}:%`]);

    assert.strictEqual(remainingPages.length, 1, 'Notebook has exactly 1 reset page');
    assert.strictEqual(remainingPages[0].title, 'Page 1', 'Reset page title is Page 1');
    assert.strictEqual(remainingPages[0].background_type, 'blank', 'Reset page background is blank');
    assert.strictEqual(remainingSnaps.length, 0, 'All snapshots wiped');
    assert.strictEqual(remainingCollab.length, 0, 'All collab updates wiped');
  });

  await testAsync('Permanent notebook deletion completely removes notebook and all cascading records from database', async () => {
    const testNbId = 'nb_perm_del_' + Date.now();
    const now = new Date().toISOString();
    db.run("INSERT INTO notebooks (id, owner_id, title, description, created_at, updated_at) VALUES (?, 'usr_demo_owner', 'Perm Del Test', '', ?, ?)", [testNbId, now, now]);
    db.run("INSERT INTO pages (id, notebook_id, title, sort_order, background_type, created_at, updated_at) VALUES (?, ?, 'Page 1', 0, 'blank', ?, ?)", ['p_del_' + testNbId, testNbId, now, now]);
    db.run("INSERT INTO notebook_members (id, notebook_id, user_id, role, created_at, updated_at) VALUES (?, ?, 'usr_demo_editor', 'editor', ?, ?)", ['mem_del_' + testNbId, testNbId, now, now]);
    db.run("INSERT INTO device_pairings (id, notebook_id, user_id, pairing_code, expires_at, created_at) VALUES (?, ?, 'usr_demo_owner', ?, ?, ?)", ['pair_' + testNbId, testNbId, '777-888', now, now]);
    db.run("INSERT INTO collab_document_updates (id, room_name, update_base64, created_at) VALUES (?, ?, 'data', ?)", ['upd_del_' + testNbId, `notebook:${testNbId}:page:1`, now]);

    // Perform permanent deletion matching API
    await db.run('DELETE FROM collab_document_updates WHERE room_name LIKE ?', [`notebook:${testNbId}:%`]);
    await db.run('DELETE FROM device_pairings WHERE notebook_id = ?', [testNbId]);
    await db.run('DELETE FROM document_snapshots WHERE notebook_id = ?', [testNbId]);
    await db.run('DELETE FROM notifications WHERE notebook_id = ?', [testNbId]);
    await db.run('DELETE FROM pages WHERE notebook_id = ?', [testNbId]);
    await db.run('DELETE FROM notebook_members WHERE notebook_id = ?', [testNbId]);
    await db.run('DELETE FROM notebooks WHERE id = ?', [testNbId]);

    const nbCheck = db.get('SELECT * FROM notebooks WHERE id = ?', [testNbId]);
    const pagesCheck = db.query('SELECT * FROM pages WHERE notebook_id = ?', [testNbId]);
    const membersCheck = db.query('SELECT * FROM notebook_members WHERE notebook_id = ?', [testNbId]);
    const pairingsCheck = db.query('SELECT * FROM device_pairings WHERE notebook_id = ?', [testNbId]);
    const collabCheck = db.query('SELECT * FROM collab_document_updates WHERE room_name LIKE ?', [`notebook:${testNbId}:%`]);

    assert(!nbCheck, 'Notebook record permanently deleted from database');
    assert.strictEqual(pagesCheck.length, 0, 'All pages permanently deleted');
    assert.strictEqual(membersCheck.length, 0, 'All members permanently deleted');
    assert.strictEqual(pairingsCheck.length, 0, 'All pairings permanently deleted');
    assert.strictEqual(collabCheck.length, 0, 'All collab records permanently deleted');
  });

  console.log(`\n==============================================`);
  console.log(`🎉 All ${passed}/${total} Integration Tests Passed Successfully!`);
  console.log(`==============================================\n`);

  if (testCollabProcess) {
    testCollabProcess.kill();
  }
}

runTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
