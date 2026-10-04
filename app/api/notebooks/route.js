import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import db from '@/lib/db';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Get owned notebooks and shared notebooks
  const notebooks = db.query(`
    SELECT DISTINCT n.*, 
      u.name as owner_name, 
      u.email as owner_email,
      COALESCE(m.role, CASE WHEN n.owner_id = ? THEN 'owner' ELSE 'viewer' END) as user_role,
      (SELECT count(*) FROM pages WHERE notebook_id = n.id AND deleted_at IS NULL) as page_count,
      (SELECT count(*) FROM notebook_members WHERE notebook_id = n.id) as member_count
    FROM notebooks n
    JOIN users u ON n.owner_id = u.id
    LEFT JOIN notebook_members m ON m.notebook_id = n.id AND m.user_id = ?
    WHERE n.deleted_at IS NULL 
      AND (n.owner_id = ? OR m.user_id = ? OR n.visibility = 'shared')
    ORDER BY n.updated_at DESC
  `, [user.id, user.id, user.id, user.id]);

  return NextResponse.json({ notebooks });
}

export async function POST(request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const title = (body.title || 'Untitled Notebook').trim();
  const description = (body.description || '').trim();
  const visibility = body.visibility === 'shared' ? 'shared' : 'private';

  const notebookId = 'nb_' + Math.random().toString(36).substring(2, 10);
  const pageId = 'pg_' + Math.random().toString(36).substring(2, 10);
  const now = new Date().toISOString();

  // Create notebook
  db.run(`
    INSERT INTO notebooks (id, owner_id, title, description, visibility, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `, [notebookId, user.id, title, description, visibility, now, now]);

  // Add owner to members
  db.run(`
    INSERT INTO notebook_members (id, notebook_id, user_id, role, created_at, updated_at)
    VALUES (?, ?, ?, 'owner', ?, ?)
  `, ['mem_' + Math.random().toString(36).substring(2, 10), notebookId, user.id, now, now]);

  // Create default first page
  db.run(`
    INSERT INTO pages (id, notebook_id, title, sort_order, background_type, created_at, updated_at)
    VALUES (?, ?, 'Page 1', 0, 'blank', ?, ?)
  `, [pageId, notebookId, now, now]);

  // Create audit log
  db.run(`
    INSERT INTO audit_logs (id, actor_user_id, action, resource_type, resource_id, created_at)
    VALUES (?, ?, 'create_notebook', 'notebook', ?, ?)
  `, ['log_' + Math.random().toString(36).substring(2, 10), user.id, notebookId, now]);

  const created = db.get('SELECT * FROM notebooks WHERE id = ?', [notebookId]);

  return NextResponse.json({ notebook: created, firstPageId: pageId });
}
