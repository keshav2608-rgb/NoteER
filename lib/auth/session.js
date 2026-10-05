import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import db from '../db/index.js';

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-notebook-key-dev-38914820';
export const SESSION_COOKIE_NAME = 'notebook_session_token';

export function getSessionCookieOptions(expiresDate) {
  const isProd = process.env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',
    path: '/',
    expires: expiresDate || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  };
}

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

    const user = await db.get(
      "SELECT id, email, name, avatar_url, status, created_at, last_login_at FROM users WHERE id = ? AND status = 'active'",
      [payload.userId]
    );
    if (!user) return null;

    // Check if user is newly registered (first session or no prior login)
    const sessionCount = await db.get('SELECT count(*) as count FROM sessions WHERE user_id = ?', [payload.userId]);
    const isNewUser = (parseInt(sessionCount?.count || 1, 10) <= 1 && (!user.last_login_at || Math.abs(new Date(user.last_login_at).getTime() - new Date(user.created_at).getTime()) < 120000));

    return { ...user, isNewUser };
  } catch (err) {
    console.error('Error fetching current user:', err);
    return null;
  }
}

export function createSession(userId, userAgent = '') {
  const sessionId = 'sess_' + crypto.randomUUID().replace(/-/g, '').substring(0, 16);
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

export async function createSessionAsync(userId, userAgent = '') {
  const sessionId = 'sess_' + crypto.randomUUID().replace(/-/g, '').substring(0, 16);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();

  await db.run(`
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

export default {
  signToken,
  verifyToken,
  getCurrentUser,
  createSession,
  createSessionAsync,
  getSessionCookieOptions,
  SESSION_COOKIE_NAME
};
