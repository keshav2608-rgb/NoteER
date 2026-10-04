export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import db from '@/lib/db';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const notifications = await db.query(`
    SELECT n.*, u.name as actor_name, u.avatar_url as actor_avatar
    FROM notifications n
    LEFT JOIN users u ON n.actor_user_id = u.id
    WHERE n.recipient_user_id = ?
    ORDER BY n.created_at DESC
    LIMIT 30
  `, [user.id]);

  const unreadCount = (notifications || []).filter((n) => !n.read_at).length;

  return NextResponse.json({ notifications, unreadCount });
}
