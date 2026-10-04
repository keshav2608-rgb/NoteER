import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import { canEditNotebook } from '@/lib/auth/permissions';
import db from '@/lib/db';

export async function PATCH(request, { params }) {
  const { pageId } = params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const page = await db.get('SELECT * FROM pages WHERE id = ?', [pageId]);
  if (!page) return NextResponse.json({ error: 'Page not found' }, { status: 404 });

  const canEdit = await canEditNotebook(user.id, page.notebook_id);
  if (!canEdit) {
    return NextResponse.json({ error: 'Forbidden: Viewers cannot modify pages' }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const now = new Date().toISOString();

  if (typeof body.title === 'string' && body.title.trim()) {
    const title = body.title.trim().substring(0, 100);
    await db.run('UPDATE pages SET title = ?, updated_at = ? WHERE id = ?', [title, now, pageId]);
  }
  if (
    body.background_type !== undefined &&
    ['blank', 'ruled', 'grid', 'dotted'].includes(body.background_type)
  ) {
    await db.run('UPDATE pages SET background_type = ?, updated_at = ? WHERE id = ?', [
      body.background_type,
      now,
      pageId
    ]);
  }
  if (typeof body.sort_order === 'number') {
    await db.run('UPDATE pages SET sort_order = ?, updated_at = ? WHERE id = ?', [
      body.sort_order,
      now,
      pageId
    ]);
  }

  const updated = await db.get('SELECT * FROM pages WHERE id = ?', [pageId]);
  return NextResponse.json({ page: updated });
}

export async function DELETE(request, { params }) {
  const { pageId } = params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const page = await db.get('SELECT * FROM pages WHERE id = ?', [pageId]);
  if (!page) return NextResponse.json({ error: 'Page not found' }, { status: 404 });

  const canEdit = await canEditNotebook(user.id, page.notebook_id);
  if (!canEdit) {
    return NextResponse.json({ error: 'Forbidden: Viewers cannot delete pages' }, { status: 403 });
  }

  // Ensure notebook has at least one active page
  const remaining = await db.get(
    'SELECT count(*) as count FROM pages WHERE notebook_id = ? AND deleted_at IS NULL AND id != ?',
    [page.notebook_id, pageId]
  );
  const remainingCount = parseInt(remaining?.count || 0, 10);
  if (remainingCount === 0) {
    return NextResponse.json({ error: 'Cannot delete the only page in the notebook' }, { status: 400 });
  }

  const now = new Date().toISOString();
  await db.run('UPDATE pages SET deleted_at = ?, updated_at = ? WHERE id = ?', [now, now, pageId]);

  return NextResponse.json({ success: true, message: 'Page deleted' });
}
