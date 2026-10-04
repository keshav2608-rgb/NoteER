import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import { canEditNotebook, canViewNotebook } from '@/lib/auth/permissions';
import db from '@/lib/db';

export async function GET(request, { params }) {
  const { notebookId } = params;
  const user = await getCurrentUser();
  if (!user || !canViewNotebook(user.id, notebookId)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const snapshots = db.query(`
    SELECT s.id, s.notebook_id, s.page_id, s.title, s.created_at, s.metadata,
           u.name as creator_name, u.avatar_url as creator_avatar
    FROM document_snapshots s
    JOIN users u ON s.created_by = u.id
    WHERE s.notebook_id = ?
    ORDER BY s.created_at DESC
    LIMIT 50
  `, [notebookId]);

  return NextResponse.json({ snapshots });
}

export async function POST(request, { params }) {
  const { notebookId } = params;
  const user = await getCurrentUser();
  if (!user || !canEditNotebook(user.id, notebookId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const pageId = body.pageId || null;
  const title = (body.title || `Snapshot ${new Date().toLocaleTimeString()}`).trim();
  const snapshotData = typeof body.snapshotData === 'string' ? body.snapshotData : JSON.stringify(body.snapshotData || {});
  const metadata = JSON.stringify(body.metadata || {});

  const snapshotId = 'snap_' + Math.random().toString(36).substring(2, 10);
  const now = new Date().toISOString();

  db.run(`
    INSERT INTO document_snapshots (id, notebook_id, page_id, title, created_by, created_at, snapshot_data, metadata)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `, [snapshotId, notebookId, pageId, title, user.id, now, snapshotData, metadata]);

  const created = db.get('SELECT * FROM document_snapshots WHERE id = ?', [snapshotId]);
  return NextResponse.json({ snapshot: created });
}
