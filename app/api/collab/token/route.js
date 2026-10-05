import { NextResponse } from 'next/server';
import { getCurrentUser, verifyToken, signToken } from '@/lib/auth/session';
import { generateCollabToken, canViewNotebook } from '@/lib/auth/permissions';
import db from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const notebookId = searchParams.get('notebookId');
  const pageId = searchParams.get('pageId') || 'default';
  const pairingCode = searchParams.get('pairing');
  const authHeader = request.headers.get('authorization');
  const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;

  if (!notebookId) {
    return NextResponse.json({ error: 'Missing notebookId' }, { status: 400 });
  }

  // 1. Scoped Canvas-Only Pairing Authentication (Tablet / Stylus via QR code or PIN)
  let stylusPayload = null;

  if (token) {
    const payload = verifyToken(token);
    if (payload && payload.scope === 'canvas_only' && payload.notebookId === notebookId) {
      if (payload.pairingId) {
        const pairingRow = await db.get(
          "SELECT status FROM device_pairings WHERE id = ?",
          [payload.pairingId]
        );
        if (pairingRow && pairingRow.status !== 'closed') {
          stylusPayload = payload;
        }
      } else {
        stylusPayload = payload;
      }
    }
  }

  if (!stylusPayload && pairingCode) {
    const cleanCode = pairingCode.trim().replace(/\s+/g, '-');
    const now = new Date().toISOString();
    const pairing = await db.get(`
      SELECT id, notebook_id FROM device_pairings
      WHERE pairing_code = ? AND notebook_id = ? AND expires_at > ? AND status NOT IN ('closed', 'superseded')
    `, [cleanCode, notebookId, now]);
    if (pairing) {
      stylusPayload = { pairingId: pairing.id, notebookId: pairing.notebook_id };
    }
  }

  // Helper to determine optimal WS URL
  const reqHost = request.headers.get('host') || 'localhost:3000';
  const hostname = reqHost.split(':')[0];
  const isHttps = request.headers.get('x-forwarded-proto') === 'https';
  const wsProtocol = isHttps ? 'wss:' : 'ws:';
  const collabPort = process.env.COLLAB_PORT || '1234';
  const resolvedWsUrl = process.env.NEXT_PUBLIC_COLLAB_WS_URL || `${wsProtocol}//${hostname}:${collabPort}`;

  if (stylusPayload) {
    // Generate a restricted, scoped collaboration token
    const collabToken = signToken({
      sub: `stylus_${stylusPayload.pairingId || 'pad'}`,
      userId: `stylus_${stylusPayload.pairingId || 'pad'}`,
      name: 'Tablet Stylus',
      avatar: '',
      notebookId,
      pageId,
      role: 'canvas_stylus',
      canEdit: true, // Allowed to draw on canvas
      isTablet: true,
      scope: 'canvas_only'
    }, '4h');

    return NextResponse.json({
      token: collabToken,
      user: {
        id: `stylus_${stylusPayload.pairingId || 'pad'}`,
        name: 'Tablet Stylus',
        avatar: ''
      },
      wsUrl: resolvedWsUrl,
      isCanvasOnly: true
    });
  }

  // 2. Standard User Authentication (PC / Desktop logged-in member)
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized: No active session or valid pairing' }, { status: 401 });
  }

  const canView = await canViewNotebook(user.id, notebookId);
  if (!canView) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const userCollabToken = await generateCollabToken(user, notebookId, pageId);
  if (!userCollabToken) {
    return NextResponse.json({ error: 'Failed to issue collaboration token' }, { status: 403 });
  }

  return NextResponse.json({
    token: userCollabToken,
    user: {
      id: user.id,
      name: user.name,
      avatar: user.avatar_url
    },
    wsUrl: resolvedWsUrl,
    isCanvasOnly: false
  });
}
