import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import { canViewNotebook, canEditNotebook, canDeleteNotebook, getUserRoleInNotebook } from '@/lib/auth/permissions';
import db from '@/lib/db';

export async function GET(request, { params }) {
  const { notebookId } = params;
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!canViewNotebook(user.id, notebookId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const notebook = db.get(`
    SELECT n.*, u.name as owner_name, u.email as owner_email, u.avatar_url as owner_avatar
    FROM notebooks n
    JOIN users u ON n.owner_id = u.id
    WHERE n.id = ? AND n.deleted_at IS NULL
  `, [notebookId]);

  if (!notebook) {
    return NextResponse.json({ error: 'Notebook not found' }, { status: 404 });
  }

  const role = getUserRoleInNotebook(user.id, notebookId);

  // Get active pages
  const pages = db.query(`
    SELECT * FROM pages
    WHERE notebook_id = ? AND deleted_at IS NULL
    ORDER BY sort_order ASC, created_at ASC
  `, [notebookId]);

  // Get members
  const members = db.query(`
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

  if (!canEditNotebook(user.id, notebookId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const now = new Date().toISOString();

  if (body.title !== undefined) {
    db.run('UPDATE notebooks SET title = ?, updated_at = ? WHERE id = ?', [body.title.trim(), now, notebookId]);
  }
  if (body.description !== undefined) {
    db.run('UPDATE notebooks SET description = ?, updated_at = ? WHERE id = ?', [body.description.trim(), now, notebookId]);
  }
  if (body.visibility !== undefined && (body.visibility === 'private' || body.visibility === 'shared')) {
    db.run('UPDATE notebooks SET visibility = ?, updated_at = ? WHERE id = ?', [body.visibility, now, notebookId]);
  }

  const updated = db.get('SELECT * FROM notebooks WHERE id = ?', [notebookId]);
  return NextResponse.json({ notebook: updated });
}

export async function DELETE(request, { params }) {
  const { notebookId } = params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (!canDeleteNotebook(user.id, notebookId)) {
    return NextResponse.json({ error: 'Only notebook owners can delete notebooks' }, { status: 403 });
  }

  const now = new Date().toISOString();
  db.run('UPDATE notebooks SET deleted_at = ?, updated_at = ? WHERE id = ?', [now, now, notebookId]);

  return NextResponse.json({ success: true, message: 'Notebook deleted' });
}
