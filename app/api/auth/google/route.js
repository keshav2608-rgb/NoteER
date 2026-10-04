import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { createSession, SESSION_COOKIE_NAME } from '@/lib/auth/session';

export async function POST(request) {
  try {
    const { credential } = await request.json();
    if (!credential) {
      return NextResponse.json({ error: 'Missing Google credential' }, { status: 400 });
    }

    // Decode Google ID Token (JWT)
    const parts = credential.split('.');
    if (parts.length !== 3) {
      return NextResponse.json({ error: 'Invalid Google credential token' }, { status: 400 });
    }

    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'));
    const { sub: googleId, email, name, picture } = payload;

    if (!googleId || !email) {
      return NextResponse.json({ error: 'Invalid Google credential claims' }, { status: 400 });
    }

    const now = new Date().toISOString();
    let user = db.get('SELECT * FROM users WHERE email = ?', [email]);

    if (!user) {
      const newUserId = 'usr_g_' + googleId.substring(0, 12);
      db.run(`
        INSERT INTO users (id, provider_user_id, email, email_verified, name, avatar_url, created_at, updated_at, last_login_at, status)
        VALUES (?, ?, ?, 1, ?, ?, ?, ?, ?, 'active')
      `, [newUserId, googleId, email, name || email.split('@')[0], picture || '', now, now, now]);

      db.run(`
        INSERT INTO auth_identities (id, user_id, provider, provider_subject, created_at)
        VALUES (?, ?, 'google', ?, ?)
      `, [`ident_${newUserId}`, newUserId, googleId, now]);

      user = db.get('SELECT * FROM users WHERE id = ?', [newUserId]);
    } else {
      db.run('UPDATE users SET last_login_at = ?, updated_at = ? WHERE id = ?', [now, now, user.id]);
    }

    const { token, expiresAt } = createSession(user.id, request.headers.get('user-agent') || 'Browser');

    const response = NextResponse.json({
      success: true,
      user
    });

    response.cookies.set({
      name: SESSION_COOKIE_NAME,
      value: token,
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      expires: new Date(expiresAt)
    });

    return response;
  } catch (err) {
    console.error('Google auth error:', err);
    return NextResponse.json({ error: 'Authentication failed' }, { status: 500 });
  }
}
