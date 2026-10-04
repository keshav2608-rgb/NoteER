import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import { canManageMembers, canViewNotebook } from '@/lib/auth/permissions';
import db from '@/lib/db';

export async function GET(request, { params }) {
  const { notebookId } = params;
  const user = await getCurrentUser();
  if (!user || !canViewNotebook(user.id, notebookId)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const members = db.query(`
    SELECT m.id, m.role, m.created_at, u.id as user_id, u.name, u.email, u.avatar_url
    FROM notebook_members m
    JOIN users u ON m.user_id = u.id
    WHERE m.notebook_id = ?
    ORDER BY m.created_at ASC
  `, [notebookId]);

  return NextResponse.json({ members });
}

export async function POST(request, { params }) {
  const { notebookId } = params;
  const user = await getCurrentUser();
  if (!user || !canManageMembers(user.id, notebookId)) {
    return NextResponse.json({ error: 'Only notebook owners can manage members' }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const email = (body.email || '').trim().toLowerCase();
  const role = ['editor', 'commenter', 'viewer'].includes(body.role) ? body.role : 'editor';

  if (!email) {
    return NextResponse.json({ error: 'Email is required' }, { status: 400 });
  }

  let targetUser = db.get('SELECT * FROM users WHERE email = ?', [email]);
  const now = new Date().toISOString();

  // If user doesn't exist yet, create a registered profile placeholder
  if (!targetUser) {
    const newId = 'usr_' + Math.random().toString(36).substring(2, 10);
    const displayName = email.split('@')[0];
    const avatar = `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(displayName)}`;

    db.run(`
      INSERT INTO users (id, provider_user_id, email, email_verified, name, avatar_url, created_at, updated_at, status)
      VALUES (?, ?, ?, 1, ?, ?, ?, ?, 'active')
    `, [newId, newId, email, displayName, avatar, now, now]);

    targetUser = db.get('SELECT * FROM users WHERE id = ?', [newId]);
  }

  // Check if member already exists
  const existingMember = db.get(
    'SELECT * FROM notebook_members WHERE notebook_id = ? AND user_id = ?',
    [notebookId, targetUser.id]
  );

  const notebook = db.get('SELECT title FROM notebooks WHERE id = ?', [notebookId]);

  if (existingMember) {
    db.run(
      'UPDATE notebook_members SET role = ?, updated_at = ? WHERE id = ?',
      [role, now, existingMember.id]
    );
  } else {
    const memberId = 'mem_' + Math.random().toString(36).substring(2, 10);
    db.run(`
      INSERT INTO notebook_members (id, notebook_id, user_id, role, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [memberId, notebookId, targetUser.id, role, now, now]);
  }

  // Send notification to recipient
  const notifId = 'notif_' + Math.random().toString(36).substring(2, 10);
  db.run(`
    INSERT INTO notifications (id, recipient_user_id, type, notebook_id, actor_user_id, payload, created_at)
    VALUES (?, ?, 'notebook_shared', ?, ?, ?, ?)
  `, [
    notifId,
    targetUser.id,
    notebookId,
    user.id,
    JSON.stringify({
      message: `${user.name} shared notebook "${notebook?.title || 'Notebook'}" with you as ${role}.`,
      role
    }),
    now
  ]);

  return NextResponse.json({ success: true, memberUser: targetUser, role });
}

export async function DELETE(request, { params }) {
  const { notebookId } = params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const targetUserId = searchParams.get('userId');

  // Can remove if owner, or if removing self (leaving)
  const isOwner = canManageMembers(user.id, notebookId);
  if (!isOwner && user.id !== targetUserId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  // Cannot remove notebook owner
  const notebook = db.get('SELECT owner_id FROM notebooks WHERE id = ?', [notebookId]);
  if (targetUserId === notebook?.owner_id) {
    return NextResponse.json({ error: 'Cannot remove the notebook owner' }, { status: 400 });
  }

  db.run('DELETE FROM notebook_members WHERE notebook_id = ? AND user_id = ?', [notebookId, targetUserId]);

  return NextResponse.json({ success: true, message: 'Member removed' });
}
