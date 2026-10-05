import { NextResponse } from 'next/server';
import QRCode from 'qrcode';
import { getCurrentUser } from '@/lib/auth/session';
import { canViewNotebook } from '@/lib/auth/permissions';
import db from '@/lib/db';
import { getLanIpAddress, getLanIpCandidates } from '@/lib/network';

export async function POST(request, { params }) {
  const { notebookId } = params;
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const canView = await canViewNotebook(user.id, notebookId);
  if (!canView) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Generate 6-digit numeric pairing code (e.g. 748-291)
  const part1 = Math.floor(100 + Math.random() * 900);
  const part2 = Math.floor(100 + Math.random() * 900);
  const pairingCode = `${part1}-${part2}`;
  const pairingId = 'pair_' + Math.random().toString(36).substring(2, 10);

  const now = new Date();
  const expiresAt = new Date(now.getTime() + 15 * 60 * 1000).toISOString(); // 15 mins

  // Invalidate any older pending pairing codes for this notebook and user
  await db.run(
    "UPDATE device_pairings SET status = 'superseded' WHERE notebook_id = ? AND user_id = ? AND status = 'pending'",
    [notebookId, user.id]
  );

  // Store new pairing code
  await db.run(`
    INSERT INTO device_pairings (id, notebook_id, user_id, pairing_code, target_device_name, status, expires_at, created_at)
    VALUES (?, ?, ?, ?, 'Desktop PC', 'pending', ?, ?)
  `, [pairingId, notebookId, user.id, pairingCode, expiresAt, now.toISOString()]);

  // Read optional client origin sent from Desktop PC browser
  let clientOrigin = null;
  try {
    if (request.headers.get('content-type')?.includes('application/json')) {
      const body = await request.json().catch(() => ({}));
      if (body.origin) clientOrigin = body.origin;
    }
  } catch (_) {}

  // Determine protocol: default to http unless explicitly running on https
  let protocol = 'http';
  let host = request.headers.get('host') || 'localhost:3000';

  if (clientOrigin) {
    try {
      const u = new URL(clientOrigin);
      protocol = u.protocol.replace(':', '');
      host = u.host;
    } catch (_) {}
  } else if (request.headers.get('x-forwarded-proto') === 'https') {
    protocol = 'https';
  }

  // Tablets cannot reach "localhost" or "127.0.0.1" of the laptop, so resolve LAN IP
  const hostParts = host.split(':');
  const hostname = hostParts[0];
  const port = hostParts[1] || (protocol === 'https' ? '443' : '3000');

  let tabletHost = host;
  if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1' || hostname === '0.0.0.0') {
    const lanIp = getLanIpAddress();
    tabletHost = port ? `${lanIp}:${port}` : lanIp;
  }

  const targetUrl = `${protocol}://${tabletHost}/notebook/${notebookId}/remote-pad?pairing=${pairingCode}`;

  let qrCodeDataUrl = '';
  try {
    qrCodeDataUrl = await QRCode.toDataURL(targetUrl, {
      width: 320,
      margin: 2,
      color: {
        dark: '#0f172a',
        light: '#ffffff'
      }
    });
  } catch (err) {
    console.error('QR code generation failed:', err);
  }

  return NextResponse.json({
    pairingCode,
    targetUrl,
    qrCodeDataUrl,
    expiresAt
  });
}
