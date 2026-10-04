import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { verifyToken } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const notebookId = searchParams.get('notebookId');
    const pairingCode = searchParams.get('pairing');
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;

    if (!notebookId) {
      return NextResponse.json({ error: 'Missing notebookId' }, { status: 400 });
    }

    let isValid = false;

    // 1. Verify via scoped stylus token
    if (token) {
      const payload = verifyToken(token);
      if (payload && payload.scope === 'canvas_only' && payload.notebookId === notebookId) {
        isValid = true;
      }
    }

    // 2. Verify via pairing code in device_pairings
    if (!isValid && pairingCode) {
      const cleanCode = pairingCode.trim().replace(/\s+/g, '-');
      const now = new Date().toISOString();
      const pairing = db.get(`
        SELECT id, notebook_id FROM device_pairings
        WHERE pairing_code = ? AND notebook_id = ? AND expires_at > ?
      `, [cleanCode, notebookId, now]);
      if (pairing) {
        isValid = true;
      }
    }

    if (!isValid) {
      return NextResponse.json({ error: 'Unauthorized: Canvas pairing is invalid or expired' }, { status: 401 });
    }

    // Return strictly minimal canvas metadata — zero personal or sensitive user data
    const notebook = db.get('SELECT id, title FROM notebooks WHERE id = ? AND deleted_at IS NULL', [notebookId]);
    if (!notebook) {
      return NextResponse.json({ error: 'Notebook not found' }, { status: 404 });
    }

    const pages = db.query(`
      SELECT id, title, sort_order, background_type FROM pages
      WHERE notebook_id = ? AND deleted_at IS NULL
      ORDER BY sort_order ASC, created_at ASC
    `, [notebookId]);

    return NextResponse.json({
      success: true,
      notebook: {
        id: notebook.id,
        title: notebook.title
      },
      pages,
      isCanvasOnly: true
    });
  } catch (err) {
    console.error('Error fetching canvas info:', err);
    return NextResponse.json({ error: 'Failed to load canvas metadata' }, { status: 500 });
  }
}
