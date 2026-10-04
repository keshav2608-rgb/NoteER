import db from '../db/index.js';

export async function logAuditEvent({ actorUserId = null, action, resourceType, resourceId, metadata = {}, ip = null }) {
  try {
    const id = 'aud_' + Math.random().toString(36).substring(2, 12);
    const now = new Date().toISOString();
    await db.run(`
      INSERT INTO audit_logs (id, actor_user_id, action, resource_type, resource_id, metadata, created_at, ip_hash_or_privacy_safe_identifier)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [id, actorUserId, action, resourceType, resourceId, JSON.stringify(metadata), now, ip]);
  } catch (err) {
    console.error('[Audit Log Error]', err.message);
  }
}
