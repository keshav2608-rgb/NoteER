import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import { canEditNotebook } from '@/lib/auth/permissions';
import db from '@/lib/db';
import { logAuditEvent } from '@/lib/auth/audit';

export async function POST(request, { params }) {
  const { notebookId } = params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const canEdit = await canEditNotebook(user.id, notebookId);
  if (!canEdit) {
    return NextResponse.json({ error: 'Forbidden: Only editors or owners can clear notebook' }, { status: 403 });
  }

  const now = new Date().toISOString();

  // 1. Wipe all persisted stroke/shape/text updates from collab storage for all pages of this notebook
  await db.run('DELETE FROM collab_document_updates WHERE room_name LIKE ?', [`notebook:${notebookId}:%`]);

  // 2. Wipe snapshots
  await db.run('DELETE FROM document_snapshots WHERE notebook_id = ?', [notebookId]);

  // 3. Reset pages: Keep a single initial empty Page 1, delete all subsequent pages
  const existingPages = await db.query(
    'SELECT id FROM pages WHERE notebook_id = ? AND deleted_at IS NULL ORDER BY sort_order ASC, created_at ASC',
    [notebookId]
  );

  let firstPageId;
  if (existingPages && existingPages.length > 0) {
    firstPageId = existingPages[0].id;
    // Reset the first page title and background_type to clean default
    await db.run(
      'UPDATE pages SET title = ?, background_type = ?, sort_order = 0, updated_at = ? WHERE id = ?',
      ['Page 1', 'dotted', now, firstPageId]
    );

    // Delete any subsequent pages
    if (existingPages.length > 1) {
      await db.run(
        'DELETE FROM pages WHERE notebook_id = ? AND id != ?',
        [notebookId, firstPageId]
      );
    }
  } else {
    firstPageId = 'pg_' + Math.random().toString(36).substring(2, 10);
    await db.run(
      'INSERT INTO pages (id, notebook_id, title, sort_order, background_type, created_at, updated_at) VALUES (?, ?, ?, 0, ?, ?, ?)',
      [firstPageId, notebookId, 'Page 1', 'dotted', now, now]
    );
  }

  // Touch notebook updated_at
  await db.run('UPDATE notebooks SET updated_at = ? WHERE id = ?', [now, notebookId]);

  await logAuditEvent({
    actorUserId: user.id,
    action: 'notebook_cleared',
    resourceType: 'notebook',
    resourceId: notebookId
  });

  const refreshedPages = await db.query(
    'SELECT * FROM pages WHERE notebook_id = ? AND deleted_at IS NULL ORDER BY sort_order ASC',
    [notebookId]
  );

  return NextResponse.json({
    success: true,
    message: 'Notebook cleared overall',
    pages: refreshedPages,
    activePageId: firstPageId
  });
}
