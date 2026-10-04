import fs from 'fs';
import path from 'path';
import os from 'os';
import { DatabaseSync } from 'node:sqlite';

let db = null;

function resolveDataDir() {
  const localDataDir = path.join(process.cwd(), 'data');
  try {
    if (!fs.existsSync(localDataDir)) {
      fs.mkdirSync(localDataDir, { recursive: true });
    }
    const probe = path.join(localDataDir, '.probe_write');
    fs.writeFileSync(probe, 'ok');
    fs.unlinkSync(probe);
    return localDataDir;
  } catch {
    const tmpDataDir = path.join(os.tmpdir(), 'notev1-data');
    if (!fs.existsSync(tmpDataDir)) {
      fs.mkdirSync(tmpDataDir, { recursive: true });
    }
    return tmpDataDir;
  }
}

function getDb() {
  if (!db) {
    const dataDir = resolveDataDir();
    const dbPath = path.join(dataDir, 'notebook.db');
    db = new DatabaseSync(dbPath);
    db.exec(`
      CREATE TABLE IF NOT EXISTS collab_document_updates (
        id TEXT PRIMARY KEY,
        room_name TEXT NOT NULL,
        update_blob BLOB,
        update_base64 TEXT,
        created_at TEXT NOT NULL
      );
    `);
  }
  return db;
}

export function saveRoomState(roomName, stateBase64) {
  try {
    const database = getDb();
    const id = 'upd_' + Math.random().toString(36).substring(2, 10);
    const now = new Date().toISOString();

    // Replace or insert latest room snapshot
    database.prepare(`
      INSERT INTO collab_document_updates (id, room_name, update_base64, created_at)
      VALUES (?, ?, ?, ?)
    `).run(id, roomName, stateBase64, now);

    // Keep only latest 10 updates per room to prevent unbounded table growth
    database.prepare(`
      DELETE FROM collab_document_updates 
      WHERE room_name = ? AND id NOT IN (
        SELECT id FROM collab_document_updates 
        WHERE room_name = ? 
        ORDER BY created_at DESC 
        LIMIT 10
      )
    `).run(roomName, roomName);
  } catch (err) {
    console.error(`[Collab Persistence] Error saving state for ${roomName}:`, err.message);
  }
}

export function loadRoomState(roomName) {
  try {
    const database = getDb();
    const row = database.prepare(`
      SELECT update_base64 FROM collab_document_updates
      WHERE room_name = ?
      ORDER BY created_at DESC
      LIMIT 1
    `).get(roomName);

    return row ? row.update_base64 : null;
  } catch (err) {
    console.error(`[Collab Persistence] Error loading state for ${roomName}:`, err.message);
    return null;
  }
}
