import db from '../lib/db/index.js';

// Uses the same database as the web app (Postgres when DATABASE_URL is set, SQLite otherwise).
// Previously this module always wrote to a local SQLite file, which is wiped on every
// restart/redeploy on ephemeral hosts such as Render — losing every drawing.

const RETRY_DELAYS_MS = [0, 500, 1500];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function withRetry(label, fn) {
  let lastErr;
  for (const delay of RETRY_DELAYS_MS) {
    if (delay) await sleep(delay);
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      console.error(`[Collab Persistence] ${label} failed: ${err.message}`);
    }
  }
  throw lastErr;
}

// Resolves true on success, false if the database stayed unreachable after retries.
export async function saveRoomState(roomName, stateBase64) {
  try {
    await withRetry(`save ${roomName}`, async () => {
      const id = 'upd_' + Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
      const now = new Date().toISOString();

      await db.run(
        `INSERT INTO collab_document_updates (id, room_name, update_base64, created_at)
         VALUES (?, ?, ?, ?)`,
        [id, roomName, stateBase64, now]
      );

      // Keep only latest 10 snapshots per room to prevent unbounded table growth
      await db.run(
        `DELETE FROM collab_document_updates
         WHERE room_name = ? AND id NOT IN (
           SELECT id FROM collab_document_updates
           WHERE room_name = ?
           ORDER BY created_at DESC, id DESC
           LIMIT 10
         )`,
        [roomName, roomName]
      );
    });
    return true;
  } catch {
    return false;
  }
}

// Returns { ok: true, state } on success (state is null for a brand-new room).
// Returns { ok: false } when the database could not be reached — callers must NOT treat
// that as "empty canvas", otherwise the next save would overwrite real drawings.
export async function loadRoomState(roomName) {
  try {
    const row = await withRetry(`load ${roomName}`, () =>
      db.get(
        `SELECT update_base64 FROM collab_document_updates
         WHERE room_name = ?
         ORDER BY created_at DESC, id DESC
         LIMIT 1`,
        [roomName]
      )
    );
    return { ok: true, state: row ? row.update_base64 : null };
  } catch {
    return { ok: false, state: null };
  }
}
