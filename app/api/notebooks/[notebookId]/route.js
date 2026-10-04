import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import {
  canViewNotebook,
  canEditNotebook,
  canDeleteNotebook,
  canManageMembers,
  getUserRoleInNotebook
} from '@/lib/auth/permissions';
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

  const notebook = await db.get(`
    SELECT n.*, u.name as owner_name, u.email as owner_email, u.avatar_url as owner_avatar
    FROM notebooks n
    JOIN users u ON n.owner_id = u.id
    WHERE n.id = ? AND n.deleted_at IS NULL
  `, [notebookId]);

  if (!notebook) {
    return NextResponse.json({ error: 'Notebook not found' }, { status: 404 });
  }

  const role = await getUserRoleInNotebook(user.id, notebookId);

  // Get active pages
  const pages = await db.query(`
    SELECT * FROM pages
    WHERE notebook_id = ? AND deleted_at IS NULL
    ORDER BY sort_order ASC, created_at ASC
  `, [notebookId]);

  // Get members
  const members = await db.query(`
    SELECT m.id as member_id, m.role, m.created_at as joined_at,
           u.id as user_id, u.name, u.email, u.avatar_url
    FROM notebook_members m
    JOIN users u ON m.user_id = u.id
    WHERE m.notebook_id = ?
    ORDER BY m.created_at ASC
  `, [notebookId]);

  return NextResponse.json({
    notebook,
    userRole: role,
    pages,
    members
  });
}

export async function PATCH(request, { params }) {
  const { notebookId } = params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const canEdit = await canEditNotebook(user.id, notebookId);
  if (!canEdit) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const now = new Date().toISOString();

  // ONLY notebook owner / creator can change visibility / sharing settings
  if (body.visibility !== undefined) {
    const isOwner = await canManageMembers(user.id, notebookId);
    if (!isOwner) {
      return NextResponse.json({ error: 'Only the notebook creator can control sharing and visibility' }, { status: 403 });
    }
    if (body.visibility === 'private' || body.visibility === 'shared') {
      await db.run('UPDATE notebooks SET visibility = ?, updated_at = ? WHERE id = ?', [body.visibility, now, notebookId]);
      await logAuditEvent({
        actorUserId: user.id,
        action: 'notebook_visibility_updated',
        resourceType: 'notebook',
        resourceId: notebookId,
        metadata: { visibility: body.visibility }
      });
    }
  }

  if (typeof body.title === 'string' && body.title.trim()) {
    const sanitizedTitle = body.title.trim().substring(0, 120);
    await db.run('UPDATE notebooks SET title = ?, updated_at = ? WHERE id = ?', [sanitizedTitle, now, notebookId]);
  }

  if (typeof body.description === 'string') {
    const sanitizedDesc = body.description.trim().substring(0, 600);
    await db.run('UPDATE notebooks SET description = ?, updated_at = ? WHERE id = ?', [sanitizedDesc, now, notebookId]);
  }

  const updated = await db.get('SELECT * FROM notebooks WHERE id = ?', [notebookId]);
  return NextResponse.json({ notebook: updated });
}

export async function DELETE(request, { params }) {
  const { notebookId } = params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const canDelete = await canDeleteNotebook(user.id, notebookId);
  if (!canDelete) {
    return NextResponse.json({ error: 'Only the notebook creator can delete this notebook' }, { status: 403 });
  }

  const now = new Date().toISOString();
  await db.run('UPDATE notebooks SET deleted_at = ?, updated_at = ? WHERE id = ?', [now, now, notebookId]);

  await logAuditEvent({
    actorUserId: user.id,
    action: 'notebook_deleted',
    resourceType: 'notebook',
    resourceId: notebookId
  });

  return NextResponse.json({ success: true, message: 'Notebook deleted' });
}
