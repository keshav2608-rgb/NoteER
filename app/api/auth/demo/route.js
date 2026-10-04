import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { createSessionAsync, SESSION_COOKIE_NAME, getSessionCookieOptions } from '@/lib/auth/session';

export async function POST(request) {
  const isDemoAllowed = process.env.NODE_ENV !== 'production' || process.env.ENABLE_DEMO_AUTH === 'true';
  if (!isDemoAllowed) {
    return NextResponse.json({ error: 'Demo authentication is disabled in production' }, { status: 403 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const { userId, customName } = body;

    let targetUser = null;

    if (userId) {
      targetUser = await db.get('SELECT * FROM users WHERE id = ?', [userId]);
    }

    if (!targetUser && customName) {
      const sanitizedName = String(customName).trim().substring(0, 50);
      const now = new Date().toISOString();
      const newId = 'usr_' + Math.random().toString(36).substring(2, 10);
      const email = `${sanitizedName.toLowerCase().replace(/[^a-z0-9]/g, '') || 'user'}@notebook.local`;
      const avatar = `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(sanitizedName)}`;

      await db.run(`
        INSERT INTO users (id, provider_user_id, email, email_verified, name, avatar_url, created_at, updated_at, status)
        VALUES (?, ?, ?, 1, ?, ?, ?, ?, 'active')
      `, [newId, newId, email, sanitizedName, avatar, now, now]);

      await db.run(`
        INSERT INTO auth_identities (id, user_id, provider, provider_subject, created_at)
        VALUES (?, ?, 'custom', ?, ?)
      `, [`ident_${newId}`, newId, email, now]);

      targetUser = await db.get('SELECT * FROM users WHERE id = ?', [newId]);
    }

    if (!targetUser) {
      targetUser = await db.get('SELECT * FROM users WHERE id = ?', ['usr_demo_owner']);
    }

    if (!targetUser) {
      return NextResponse.json({ error: 'User account not found' }, { status: 404 });
    }

    const { token, expiresAt } = await createSessionAsync(targetUser.id, request.headers.get('user-agent') || 'Browser');

    const response = NextResponse.json({
      success: true,
      user: targetUser
    });

    response.cookies.set({
      name: SESSION_COOKIE_NAME,
      value: token,
      ...getSessionCookieOptions(new Date(expiresAt))
    });

    return response;
  } catch (err) {
    console.error('Demo login error:', err);
    return NextResponse.json({ error: 'Failed to authenticate demo account' }, { status: 500 });
  }
}
