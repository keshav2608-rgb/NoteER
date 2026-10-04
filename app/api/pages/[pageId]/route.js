import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import { canEditNotebook } from '@/lib/auth/permissions';
import db from '@/lib/db';

export async function PATCH(request, { params }) {
  const { pageId } = params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const page = db.get('SELECT * FROM pages WHERE id = ?', [pageId]);
  if (!page) return NextResponse.json({ error: 'Page not found' }, { status: 404 });

  if (!canEditNotebook(user.id, page.notebook_id)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const now = new Date().toISOString();

  if (body.title !== undefined) {
    db.run('UPDATE pages SET title = ?, updated_at = ? WHERE id = ?', [body.title.trim(), now, pageId]);
  }
  if (body.background_type !== undefined && ['blank', 'ruled', 'grid', 'dotted'].includes(body.background_type)) {
    db.run('UPDATE pages SET background_type = ?, updated_at = ? WHERE id = ?', [body.background_type, now, pageId]);
  }
  if (body.sort_order !== undefined) {
    db.run('UPDATE pages SET sort_order = ?, updated_at = ? WHERE id = ?', [body.sort_order, now, pageId]);
  }

  const updated = db.get('SELECT * FROM pages WHERE id = ?', [pageId]);
  return NextResponse.json({ page: updated });
}

export async function DELETE(request, { params }) {
  const { pageId } = params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const page = db.get('SELECT * FROM pages WHERE id = ?', [pageId]);
  if (!page) return NextResponse.json({ error: 'Page not found' }, { status: 404 });

  if (!canEditNotebook(user.id, page.notebook_id)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Ensure notebook has at least one active page
  const remaining = db.get('SELECT count(*) as count FROM pages WHERE notebook_id = ? AND deleted_at IS NULL AND id != ?', [page.notebook_id, pageId]);
  if (remaining?.count === 0) {
    return NextResponse.json({ error: 'Cannot delete the only page in the notebook' }, { status: 400 });
  }

  const now = new Date().toISOString();
  db.run('UPDATE pages SET deleted_at = ?, updated_at = ? WHERE id = ?', [now, now, pageId]);

  return NextResponse.json({ success: true, message: 'Page deleted' });
}
