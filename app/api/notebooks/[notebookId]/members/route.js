import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import { canManageMembers, canViewNotebook } from '@/lib/auth/permissions';
import db from '@/lib/db';
import { logAuditEvent } from '@/lib/auth/audit';

export async function GET(request, { params }) {
  const { notebookId } = params;
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const canView = await canViewNotebook(user.id, notebookId);
  if (!canView) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const members = await db.query(`
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
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const isOwner = await canManageMembers(user.id, notebookId);
  if (!isOwner) {
    return NextResponse.json(
      { error: 'Only the notebook creator can control sharing and invite collaborators' },
      { status: 403 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const email = (body.email || '').trim().toLowerCase();
  const role = ['editor', 'commenter', 'viewer'].includes(body.role) ? body.role : 'editor';

  // Strict email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email || !emailRegex.test(email) || email.length > 254) {
    return NextResponse.json({ error: 'A valid email address is required' }, { status: 400 });
  }

  let targetUser = await db.get('SELECT * FROM users WHERE email = ?', [email]);
  const now = new Date().toISOString();

  // If user doesn't exist yet, create a registered profile placeholder
  if (!targetUser) {
    const newId = 'usr_' + Math.random().toString(36).substring(2, 10);
    const displayName = email.split('@')[0].substring(0, 50);
    const avatar = `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(displayName)}`;

    await db.run(`
      INSERT INTO users (id, provider_user_id, email, email_verified, name, avatar_url, created_at, updated_at, status)
      VALUES (?, ?, ?, 1, ?, ?, ?, ?, 'active')
    `, [newId, newId, email, displayName, avatar, now, now]);

    targetUser = await db.get('SELECT * FROM users WHERE id = ?', [newId]);
  }

  // Check if member already exists
  const existingMember = await db.get(
    'SELECT * FROM notebook_members WHERE notebook_id = ? AND user_id = ?',
    [notebookId, targetUser.id]
  );

  const notebook = await db.get('SELECT title FROM notebooks WHERE id = ?', [notebookId]);

  if (existingMember) {
    await db.run(
      'UPDATE notebook_members SET role = ?, updated_at = ? WHERE id = ?',
      [role, now, existingMember.id]
    );
  } else {
    const memberId = 'mem_' + Math.random().toString(36).substring(2, 10);
    await db.run(`
      INSERT INTO notebook_members (id, notebook_id, user_id, role, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [memberId, notebookId, targetUser.id, role, now, now]);
  }

  // Send notification to recipient
  const notifId = 'notif_' + Math.random().toString(36).substring(2, 10);
  await db.run(`
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

  await logAuditEvent({
    actorUserId: user.id,
    action: 'notebook_member_invited',
    resourceType: 'notebook',
    resourceId: notebookId,
    metadata: { invitedUserId: targetUser.id, invitedEmail: email, role }
  });

  return NextResponse.json({ success: true, memberUser: targetUser, role });
}

export async function DELETE(request, { params }) {
  const { notebookId } = params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const targetUserId = searchParams.get('userId');

  if (!targetUserId) {
    return NextResponse.json({ error: 'userId is required' }, { status: 400 });
  }

  const isOwner = await canManageMembers(user.id, notebookId);
  // Only owner can remove others; members can only remove themselves
  if (!isOwner && user.id !== targetUserId) {
    return NextResponse.json({ error: 'Only the notebook creator can remove collaborators' }, { status: 403 });
  }

  // Prevent removing the notebook owner
  const notebook = await db.get('SELECT owner_id FROM notebooks WHERE id = ?', [notebookId]);
  if (targetUserId === notebook?.owner_id) {
    return NextResponse.json({ error: 'Cannot remove the notebook creator' }, { status: 400 });
  }

  await db.run('DELETE FROM notebook_members WHERE notebook_id = ? AND user_id = ?', [notebookId, targetUserId]);

  await logAuditEvent({
    actorUserId: user.id,
    action: 'notebook_member_removed',
    resourceType: 'notebook',
    resourceId: notebookId,
    metadata: { removedUserId: targetUserId }
  });

  return NextResponse.json({ success: true, message: 'Member removed' });
}
