import fs from 'fs';
import path from 'path';
import os from 'os';
import { DatabaseSync } from 'node:sqlite';
import pg from 'pg';

const { Pool } = pg;
let sqliteDb = null;
let pgPool = null;
let pgInitPromise = null;

// Resolve safe writable directory for SQLite (handles read-only serverless filesystems)
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

function getSqliteDb() {
  if (!sqliteDb) {
    const dataDir = resolveDataDir();
    const dbPath = path.join(dataDir, 'notebook.db');
    sqliteDb = new DatabaseSync(dbPath);
    sqliteDb.exec('PRAGMA foreign_keys = ON;');
    try {
      sqliteDb.exec('PRAGMA journal_mode = WAL;');
    } catch {
      // Fallback if WAL is not supported on ephemeral/virtual FS
    }
    initSchemaSqlite(sqliteDb);
  }
  return sqliteDb;
}

function getPgPool() {
  if (!pgPool) {
    const isLocal =
      process.env.DATABASE_URL?.includes('localhost') ||
      process.env.DATABASE_URL?.includes('127.0.0.1');
    pgPool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: isLocal ? false : { rejectUnauthorized: false },
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000
    });
  }
  return pgPool;
}

// Convert SQLite '?' parameter placeholders to PostgreSQL '$1', '$2', ...
export function toPgQuery(sql) {
  let paramIndex = 1;
  return sql.replace(/\?/g, () => `$${paramIndex++}`);
}

async function ensurePgSchema(pool) {
  if (pgInitPromise) return pgInitPromise;
  pgInitPromise = (async () => {
    const client = await pool.connect();
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY,
          provider_user_id TEXT,
          email TEXT UNIQUE NOT NULL,
          email_verified INTEGER DEFAULT 1,
          name TEXT NOT NULL,
          avatar_url TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          last_login_at TEXT,
          status TEXT DEFAULT 'active'
        );

        CREATE TABLE IF NOT EXISTS auth_identities (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          provider TEXT NOT NULL,
          provider_subject TEXT NOT NULL,
          created_at TEXT NOT NULL,
          UNIQUE(provider, provider_subject)
        );

        CREATE TABLE IF NOT EXISTS sessions (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          expires_at TEXT NOT NULL,
          created_at TEXT NOT NULL,
          last_seen_at TEXT,
          revoked_at TEXT,
          user_agent TEXT
        );

        CREATE TABLE IF NOT EXISTS notebooks (
          id TEXT PRIMARY KEY,
          owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          title TEXT NOT NULL,
          description TEXT,
          visibility TEXT DEFAULT 'private',
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          deleted_at TEXT
        );

        CREATE TABLE IF NOT EXISTS notebook_members (
          id TEXT PRIMARY KEY,
          notebook_id TEXT NOT NULL REFERENCES notebooks(id) ON DELETE CASCADE,
          user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          role TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          UNIQUE(notebook_id, user_id)
        );

        CREATE TABLE IF NOT EXISTS pages (
          id TEXT PRIMARY KEY,
          notebook_id TEXT NOT NULL REFERENCES notebooks(id) ON DELETE CASCADE,
          title TEXT NOT NULL,
          sort_order INTEGER NOT NULL DEFAULT 0,
          background_type TEXT DEFAULT 'blank',
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          deleted_at TEXT
        );

        CREATE TABLE IF NOT EXISTS document_snapshots (
          id TEXT PRIMARY KEY,
          notebook_id TEXT NOT NULL REFERENCES notebooks(id) ON DELETE CASCADE,
          page_id TEXT REFERENCES pages(id) ON DELETE SET NULL,
          title TEXT,
          created_by TEXT NOT NULL REFERENCES users(id),
          created_at TEXT NOT NULL,
          snapshot_data TEXT NOT NULL,
          metadata TEXT
        );

        CREATE TABLE IF NOT EXISTS notifications (
          id TEXT PRIMARY KEY,
          recipient_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          type TEXT NOT NULL,
          notebook_id TEXT REFERENCES notebooks(id) ON DELETE CASCADE,
          actor_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
          payload TEXT,
          read_at TEXT,
          created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS notification_devices (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          device_id TEXT NOT NULL,
          push_token TEXT,
          platform TEXT,
          created_at TEXT NOT NULL,
          last_seen_at TEXT,
          revoked_at TEXT,
          UNIQUE(user_id, device_id)
        );

        CREATE TABLE IF NOT EXISTS audit_logs (
          id TEXT PRIMARY KEY,
          actor_user_id TEXT,
          action TEXT NOT NULL,
          resource_type TEXT NOT NULL,
          resource_id TEXT NOT NULL,
          metadata TEXT,
          created_at TEXT NOT NULL,
          ip_hash_or_privacy_safe_identifier TEXT
        );

        CREATE TABLE IF NOT EXISTS device_pairings (
          id TEXT PRIMARY KEY,
          notebook_id TEXT NOT NULL REFERENCES notebooks(id) ON DELETE CASCADE,
          user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          pairing_code TEXT NOT NULL UNIQUE,
          target_device_name TEXT DEFAULT 'PC',
          status TEXT DEFAULT 'pending',
          expires_at TEXT NOT NULL,
          created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS collab_document_updates (
          id TEXT PRIMARY KEY,
          room_name TEXT NOT NULL,
          update_blob BYTEA,
          update_base64 TEXT,
          created_at TEXT NOT NULL
        );
      `);
    } finally {
      client.release();
    }
  })();
  return pgInitPromise;
}

function initSchemaSqlite(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      provider_user_id TEXT,
      email TEXT UNIQUE NOT NULL,
      email_verified INTEGER DEFAULT 1,
      name TEXT NOT NULL,
      avatar_url TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      last_login_at TEXT,
      status TEXT DEFAULT 'active'
    );

    CREATE TABLE IF NOT EXISTS auth_identities (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      provider TEXT NOT NULL,
      provider_subject TEXT NOT NULL,
      created_at TEXT NOT NULL,
      UNIQUE(provider, provider_subject)
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      last_seen_at TEXT,
      revoked_at TEXT,
      user_agent TEXT
    );

    CREATE TABLE IF NOT EXISTS notebooks (
      id TEXT PRIMARY KEY,
      owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      description TEXT,
      visibility TEXT DEFAULT 'private',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT
    );

    CREATE TABLE IF NOT EXISTS notebook_members (
      id TEXT PRIMARY KEY,
      notebook_id TEXT NOT NULL REFERENCES notebooks(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(notebook_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS pages (
      id TEXT PRIMARY KEY,
      notebook_id TEXT NOT NULL REFERENCES notebooks(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      background_type TEXT DEFAULT 'blank',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT
    );

    CREATE TABLE IF NOT EXISTS document_snapshots (
      id TEXT PRIMARY KEY,
      notebook_id TEXT NOT NULL REFERENCES notebooks(id) ON DELETE CASCADE,
      page_id TEXT REFERENCES pages(id) ON DELETE SET NULL,
      title TEXT,
      created_by TEXT NOT NULL REFERENCES users(id),
      created_at TEXT NOT NULL,
      snapshot_data TEXT NOT NULL,
      metadata TEXT
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      recipient_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      notebook_id TEXT REFERENCES notebooks(id) ON DELETE CASCADE,
      actor_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
      payload TEXT,
      read_at TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS notification_devices (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      device_id TEXT NOT NULL,
      push_token TEXT,
      platform TEXT,
      created_at TEXT NOT NULL,
      last_seen_at TEXT,
      revoked_at TEXT,
      UNIQUE(user_id, device_id)
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      actor_user_id TEXT,
      action TEXT NOT NULL,
      resource_type TEXT NOT NULL,
      resource_id TEXT NOT NULL,
      metadata TEXT,
      created_at TEXT NOT NULL,
      ip_hash_or_privacy_safe_identifier TEXT
    );

    CREATE TABLE IF NOT EXISTS device_pairings (
      id TEXT PRIMARY KEY,
      notebook_id TEXT NOT NULL REFERENCES notebooks(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      pairing_code TEXT NOT NULL UNIQUE,
      target_device_name TEXT DEFAULT 'PC',
      status TEXT DEFAULT 'pending',
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS collab_document_updates (
      id TEXT PRIMARY KEY,
      room_name TEXT NOT NULL,
      update_blob BLOB,
      update_base64 TEXT,
      created_at TEXT NOT NULL
    );
  `);

  const shouldSeedDemo =
    (process.env.NODE_ENV !== 'production' || process.env.SEED_DEMO_DATA === 'true') &&
    process.env.ENABLE_DEMO_AUTH !== 'false';
  if (shouldSeedDemo) {
    seedDefaultData(db);
  }
}

function seedDefaultData(db) {
  const existing = db.prepare('SELECT count(*) as count FROM users').get();
  if (existing && existing.count > 0) return;

  const now = new Date().toISOString();

  const demoUsers = [
    {
      id: 'usr_demo_owner',
      name: 'Keshav (Notebook Owner)',
      email: 'keshav@notebook.local',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=128&h=128&fit=crop&crop=faces'
    },
    {
      id: 'usr_demo_editor',
      name: 'Alex Rivera (Collaborator)',
      email: 'alex@notebook.local',
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=128&h=128&fit=crop&crop=faces'
    },
    {
      id: 'usr_demo_viewer',
      name: 'Sam Chen (Viewer)',
      email: 'sam@notebook.local',
      avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=128&h=128&fit=crop&crop=faces'
    }
  ];

  for (const u of demoUsers) {
    db.prepare(`
      INSERT INTO users (id, provider_user_id, email, email_verified, name, avatar_url, created_at, updated_at, status)
      VALUES (?, ?, ?, 1, ?, ?, ?, ?, 'active')
    `).run(u.id, u.id, u.email, u.name, u.avatar, now, now);

    db.prepare(`
      INSERT INTO auth_identities (id, user_id, provider, provider_subject, created_at)
      VALUES (?, ?, 'demo', ?, ?)
    `).run(`ident_${u.id}`, u.id, u.email, now);
  }

  const notebookId = 'nb_starter_welcome';
  db.prepare(`
    INSERT INTO notebooks (id, owner_id, title, description, visibility, created_at, updated_at)
    VALUES (?, 'usr_demo_owner', 'Project Brainstorm & Architecture', 'Collaborative digital notebook for product ideas and multi-device drawing', 'shared', ?, ?)
  `).run(notebookId, now, now);

  db.prepare(`
    INSERT INTO notebook_members (id, notebook_id, user_id, role, created_at, updated_at)
    VALUES ('mem_1', ?, 'usr_demo_owner', 'owner', ?, ?),
           ('mem_2', ?, 'usr_demo_editor', 'editor', ?, ?),
           ('mem_3', ?, 'usr_demo_viewer', 'viewer', ?, ?)
  `).run(notebookId, now, now, notebookId, now, now, notebookId, now, now);

  const pages = [
    { id: 'page_overview', title: 'Page 1 — Overview & Vision', order: 0, bg: 'dotted' },
    { id: 'page_sketch', title: 'Page 2 — Wireframe & Remote Pad', order: 1, bg: 'grid' },
    { id: 'page_notes', title: 'Page 3 — Meeting Notes', order: 2, bg: 'ruled' }
  ];

  for (const p of pages) {
    db.prepare(`
      INSERT INTO pages (id, notebook_id, title, sort_order, background_type, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(p.id, notebookId, p.title, p.order, p.bg, now, now);
  }

  db.prepare(`
    INSERT INTO notifications (id, recipient_user_id, type, notebook_id, actor_user_id, payload, created_at)
    VALUES ('notif_welcome', 'usr_demo_owner', 'notebook_shared', ?, 'usr_demo_editor', ?, ?)
  `).run(notebookId, JSON.stringify({ message: 'Alex Rivera joined Project Brainstorm & Architecture as Editor' }), now);
}

export const db = {
  isPostgres() {
    return Boolean(process.env.DATABASE_URL);
  },

  query(sql, params = []) {
    if (process.env.DATABASE_URL) {
      return (async () => {
        const pool = getPgPool();
        await ensurePgSchema(pool);
        const pgSql = toPgQuery(sql);
        const res = await pool.query(pgSql, params);
        return res.rows;
      })();
    }
    const database = getSqliteDb();
    try {
      const stmt = database.prepare(sql);
      return stmt.all(...params);
    } catch (err) {
      console.error('SQL Query Error:', err.message, { sql, params });
      throw err;
    }
  },

  get(sql, params = []) {
    if (process.env.DATABASE_URL) {
      return (async () => {
        const pool = getPgPool();
        await ensurePgSchema(pool);
        const pgSql = toPgQuery(sql);
        const res = await pool.query(pgSql, params);
        return res.rows[0] || null;
      })();
    }
    const database = getSqliteDb();
    try {
      const stmt = database.prepare(sql);
      const row = stmt.get(...params);
      return row || null;
    } catch (err) {
      console.error('SQL Get Error:', err.message, { sql, params });
      throw err;
    }
  },

  run(sql, params = []) {
    if (process.env.DATABASE_URL) {
      return (async () => {
        const pool = getPgPool();
        await ensurePgSchema(pool);
        const pgSql = toPgQuery(sql);
        const res = await pool.query(pgSql, params);
        return { changes: res.rowCount };
      })();
    }
    const database = getSqliteDb();
    try {
      const stmt = database.prepare(sql);
      return stmt.run(...params);
    } catch (err) {
      console.error('SQL Run Error:', err.message, { sql, params });
      throw err;
    }
  },

  exec(sql) {
    if (process.env.DATABASE_URL) {
      return (async () => {
        const pool = getPgPool();
        await ensurePgSchema(pool);
        return pool.query(sql);
      })();
    }
    const database = getSqliteDb();
    return database.exec(sql);
  }
};

export default db;
