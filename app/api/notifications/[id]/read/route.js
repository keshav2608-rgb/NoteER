import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import db from '@/lib/db';

export async function POST(request, { params }) {
  const { id } = params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const now = new Date().toISOString();
  if (id === 'all') {
    await db.run('UPDATE notifications SET read_at = ? WHERE recipient_user_id = ? AND read_at IS NULL', [
      now,
      user.id
    ]);
  } else {
    await db.run('UPDATE notifications SET read_at = ? WHERE id = ? AND recipient_user_id = ?', [
      now,
      id,
      user.id
    ]);
  }

  return NextResponse.json({ success: true });
}
