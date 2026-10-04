import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { createSessionAsync, createSession, SESSION_COOKIE_NAME, getSessionCookieOptions } from '@/lib/auth/session';
import { logAuditEvent } from '@/lib/auth/audit';

export async function POST(request) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.ip || 'unknown';

  try {
    const { credential } = await request.json().catch(() => ({}));
    if (!credential) {
      return NextResponse.json({ error: 'Missing Google credential' }, { status: 400 });
    }

    // Cryptographically verify Google ID Token with Google OAuth2 API
    const verifyUrl = `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`;
    const googleRes = await fetch(verifyUrl, { method: 'GET' });

    if (!googleRes.ok) {
      await logAuditEvent({
        action: 'login_google_failed',
        resourceType: 'auth',
        resourceId: 'google',
        metadata: { reason: 'Token verification rejected by Google API' },
        ip
      });
      return NextResponse.json({ error: 'Invalid or forged Google token' }, { status: 401 });
    }

    const payload = await googleRes.json();
    const { sub: googleId, email, name, picture, aud, iss, email_verified } = payload;

    // Validate token issuer
    const validIssuers = ['accounts.google.com', 'https://accounts.google.com'];
    if (!validIssuers.includes(iss)) {
      return NextResponse.json({ error: 'Untrusted token issuer' }, { status: 401 });
    }

    // Validate token audience against configured Google Client ID if available
    const expectedClientId = process.env.GOOGLE_CLIENT_ID || process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    if (expectedClientId && aud !== expectedClientId) {
      return NextResponse.json({ error: 'Token audience mismatch' }, { status: 401 });
    }

    // Ensure email is verified by Google
    if (email_verified !== 'true' && email_verified !== true) {
      return NextResponse.json({ error: 'Google account email is not verified' }, { status: 403 });
    }

    if (!googleId || !email) {
      return NextResponse.json({ error: 'Invalid Google credential claims' }, { status: 400 });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const now = new Date().toISOString();

    let user = await db.get('SELECT * FROM users WHERE email = ?', [normalizedEmail]);

    if (!user) {
      const newUserId = 'usr_g_' + googleId.substring(0, 12);
      await db.run(`
        INSERT INTO users (id, provider_user_id, email, email_verified, name, avatar_url, created_at, updated_at, last_login_at, status)
        VALUES (?, ?, ?, 1, ?, ?, ?, ?, ?, 'active')
      `, [newUserId, googleId, normalizedEmail, name || normalizedEmail.split('@')[0], picture || '', now, now, now]);

      await db.run(`
        INSERT INTO auth_identities (id, user_id, provider, provider_subject, created_at)
        VALUES (?, ?, 'google', ?, ?)
      `, [`ident_${newUserId}`, newUserId, googleId, now]);

      user = await db.get('SELECT * FROM users WHERE id = ?', [newUserId]);

      await logAuditEvent({
        actorUserId: user.id,
        action: 'user_registered_google',
        resourceType: 'user',
        resourceId: user.id,
        metadata: { email: normalizedEmail },
        ip
      });
    } else {
      // Check if user status is active
      if (user.status !== 'active') {
        return NextResponse.json({ error: 'Account has been deactivated. Please contact support.' }, { status: 403 });
      }

      await db.run('UPDATE users SET last_login_at = ?, updated_at = ? WHERE id = ?', [now, now, user.id]);

      await logAuditEvent({
        actorUserId: user.id,
        action: 'login_google_success',
        resourceType: 'user',
        resourceId: user.id,
        metadata: { email: normalizedEmail },
        ip
      });
    }

    const userAgent = request.headers.get('user-agent') || 'Browser';
    const { token, expiresAt } = await createSessionAsync(user.id, userAgent);

    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatar_url: user.avatar_url
      }
    });

    response.cookies.set({
      name: SESSION_COOKIE_NAME,
      value: token,
      ...getSessionCookieOptions(new Date(expiresAt))
    });

    return response;
  } catch (err) {
    console.error('Google auth error:', err);
    return NextResponse.json({ error: 'Authentication failed due to internal error' }, { status: 500 });
  }
}
