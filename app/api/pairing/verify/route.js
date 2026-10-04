import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { signToken } from '@/lib/auth/session';

export async function POST(request) {
  try {
    const { code } = await request.json();
    if (!code) {
      return NextResponse.json({ error: 'Pairing code required' }, { status: 400 });
    }

    const cleanCode = code.trim().replace(/\s+/g, '-');
    const now = new Date().toISOString();

    const pairing = db.get(`
      SELECT * FROM device_pairings
      WHERE pairing_code = ? AND expires_at > ?
    `, [cleanCode, now]);

    if (!pairing) {
      return NextResponse.json({ error: 'Invalid or expired pairing code' }, { status: 404 });
    }

    // Mark as paired
    db.run("UPDATE device_pairings SET status = 'paired' WHERE id = ?", [pairing.id]);

    // Issue a restricted, canvas-only device token (valid for 24 hours)
    const stylusToken = signToken({
      pairingId: pairing.id,
      notebookId: pairing.notebook_id,
      scope: 'canvas_only',
      role: 'canvas_stylus',
      createdAt: now
    }, '24h');

    return NextResponse.json({
      success: true,
      notebookId: pairing.notebook_id,
      stylusToken,
      isCanvasOnly: true,
      redirectUrl: `/notebook/${pairing.notebook_id}/remote-pad?pairing=${pairing.pairing_code}`
    });
  } catch (err) {
    return NextResponse.json({ error: 'Verification failed' }, { status: 500 });
  }
}
