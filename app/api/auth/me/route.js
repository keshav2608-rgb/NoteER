export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getCurrentUser, SESSION_COOKIE_NAME } from '@/lib/auth/session';
import db from '@/lib/db';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    const response = NextResponse.json({ authenticated: false, user: null });
    // Explicitly delete any stale or invalidated session cookie
    response.cookies.delete(SESSION_COOKIE_NAME);
    return response;
  }

  // Get unread notification count
  const unreadNotif = await db.get(
    'SELECT count(*) as count FROM notifications WHERE recipient_user_id = ? AND read_at IS NULL',
    [user.id]
  );

  return NextResponse.json({
    authenticated: true,
    user,
    unreadNotifications: parseInt(unreadNotif?.count || 0, 10)
  });
}
