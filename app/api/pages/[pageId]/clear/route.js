import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import { canEditNotebook } from '@/lib/auth/permissions';
import db from '@/lib/db';

export async function POST(request, { params }) {
  const { pageId } = params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const page = await db.get('SELECT * FROM pages WHERE id = ?', [pageId]);
  if (!page) return NextResponse.json({ error: 'Page not found' }, { status: 404 });

  const canEdit = await canEditNotebook(user.id, page.notebook_id);
  if (!canEdit) {
    return NextResponse.json({ error: 'Forbidden: Viewers cannot modify pages' }, { status: 403 });
  }

  // Wipe all collab document updates for this page from database
  await db.run('DELETE FROM collab_document_updates WHERE room_name = ?', [`notebook:${page.notebook_id}:page:${pageId}`]);

  return NextResponse.json({ success: true, message: 'Page canvas cleared successfully' });
}
