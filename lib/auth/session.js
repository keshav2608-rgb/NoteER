import jwt from 'jsonwebtoken';
import db from '../db/index.js';

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-notebook-key-dev-38914820';
export const SESSION_COOKIE_NAME = 'notebook_session_token';

export function signToken(payload, expiresIn = '7d') {
  return jwt.sign(payload, JWT_SECRET, { expiresIn });
}

export function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

export async function getCurrentUser() {
  try {
    const nextHeaders = await import('next/headers.js').catch(() => null);
    if (!nextHeaders?.cookies) return null;

    const cookieStore = nextHeaders.cookies();
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    if (!token) return null;

    const payload = verifyToken(token);
    if (!payload?.userId) return null;

    const user = db.get("SELECT id, email, name, avatar_url, status FROM users WHERE id = ? AND status = 'active'", [payload.userId]);
    return user || null;
  } catch (err) {
    console.error('Error fetching current user:', err);
    return null;
  }
}

export function createSession(userId, userAgent = '') {
  const sessionId = 'sess_' + Math.random().toString(36).substring(2, 12);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
  
  db.run(`
    INSERT INTO sessions (id, user_id, expires_at, created_at, last_seen_at, user_agent)
    VALUES (?, ?, ?, ?, ?, ?)
  `, [sessionId, userId, expiresAt, now.toISOString(), now.toISOString(), userAgent]);

  const token = signToken({
    sessionId,
    userId,
    createdAt: now.toISOString()
  });

  return { token, sessionId, expiresAt };
}
