export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import db from '@/lib/db';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ authenticated: false, user: null });
  }

  // Get unread notification count
  const unreadNotif = db.get(
    'SELECT count(*) as count FROM notifications WHERE recipient_user_id = ? AND read_at IS NULL',
    [user.id]
  );

  return NextResponse.json({
    authenticated: true,
    user,
    unreadNotifications: unreadNotif?.count || 0
  });
}
