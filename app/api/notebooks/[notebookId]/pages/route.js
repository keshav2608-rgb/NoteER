import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import { canEditNotebook, canViewNotebook } from '@/lib/auth/permissions';
import db from '@/lib/db';

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

  const pages = await db.query(`
    SELECT * FROM pages
    WHERE notebook_id = ? AND deleted_at IS NULL
    ORDER BY sort_order ASC, created_at ASC
  `, [notebookId]);

  return NextResponse.json({ pages });
}

export async function POST(request, { params }) {
  const { notebookId } = params;
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const canEdit = await canEditNotebook(user.id, notebookId);
  if (!canEdit) {
    return NextResponse.json({ error: 'Forbidden: Viewers cannot create or modify pages' }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const action = body.action || 'create';

  // Handle reordering
  if (action === 'reorder') {
    const pageOrders = body.orders; // Array of { id, sort_order }
    if (Array.isArray(pageOrders)) {
      for (const item of pageOrders) {
        if (item.id && typeof item.sort_order === 'number') {
          await db.run('UPDATE pages SET sort_order = ? WHERE id = ? AND notebook_id = ?', [
            item.sort_order,
            item.id,
            notebookId
          ]);
        }
      }
    }
    const updatedPages = await db.query(
      'SELECT * FROM pages WHERE notebook_id = ? AND deleted_at IS NULL ORDER BY sort_order ASC',
      [notebookId]
    );
    return NextResponse.json({ pages: updatedPages });
  }

  // Handle create or duplicate
  const pageCountResult = await db.get(
    'SELECT count(*) as count FROM pages WHERE notebook_id = ? AND deleted_at IS NULL',
    [notebookId]
  );
  const totalPages = parseInt(pageCountResult?.count || 0, 10);
  const pageIndex = totalPages + 1;
  const pageId = 'pg_' + Math.random().toString(36).substring(2, 10);
  const rawTitle = typeof body.title === 'string' ? body.title.trim() : '';
  const title = (rawTitle || `Page ${pageIndex}`).substring(0, 100);
  const backgroundType = ['blank', 'ruled', 'grid', 'dotted'].includes(body.background_type)
    ? body.background_type
    : 'blank';
  const now = new Date().toISOString();

  await db.run(`
    INSERT INTO pages (id, notebook_id, title, sort_order, background_type, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `, [pageId, notebookId, title, pageIndex - 1, backgroundType, now, now]);

  const newPage = await db.get('SELECT * FROM pages WHERE id = ?', [pageId]);
  return NextResponse.json({ page: newPage });
}
