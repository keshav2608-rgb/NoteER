import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { createSession, SESSION_COOKIE_NAME } from '@/lib/auth/session';

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { userId, customName } = body;

    let targetUser = null;

    if (userId) {
      targetUser = db.get('SELECT * FROM users WHERE id = ?', [userId]);
    }

    if (!targetUser && customName) {
      const now = new Date().toISOString();
      const newId = 'usr_' + Math.random().toString(36).substring(2, 10);
      const email = `${customName.toLowerCase().replace(/[^a-z0-9]/g, '') || 'user'}@notebook.local`;
      const avatar = `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(customName)}`;

      db.run(`
        INSERT INTO users (id, provider_user_id, email, email_verified, name, avatar_url, created_at, updated_at, status)
        VALUES (?, ?, ?, 1, ?, ?, ?, ?, 'active')
      `, [newId, newId, email, customName, avatar, now, now]);

      db.run(`
        INSERT INTO auth_identities (id, user_id, provider, provider_subject, created_at)
        VALUES (?, ?, 'custom', ?, ?)
      `, [`ident_${newId}`, newId, email, now]);

      targetUser = db.get('SELECT * FROM users WHERE id = ?', [newId]);
    }

    if (!targetUser) {
      // Default fallback to owner
      targetUser = db.get('SELECT * FROM users WHERE id = ?', ['usr_demo_owner']);
    }

    const { token, expiresAt } = createSession(targetUser.id, request.headers.get('user-agent') || 'Browser');

    const response = NextResponse.json({
      success: true,
      user: targetUser
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
    console.error('Demo login error:', err);
    return NextResponse.json({ error: 'Failed to authenticate demo account' }, { status: 500 });
  }
}
