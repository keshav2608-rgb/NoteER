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

  // Store pairing code
  await db.run(`
    INSERT INTO device_pairings (id, notebook_id, user_id, pairing_code, target_device_name, status, expires_at, created_at)
    VALUES (?, ?, ?, ?, 'Desktop PC', 'pending', ?, ?)
  `, [pairingId, notebookId, user.id, pairingCode, expiresAt, now.toISOString()]);

  // Allow client to request a specific IP override if desired
  let requestedIp = null;
  try {
    const url = new URL(request.url);
    requestedIp = url.searchParams.get('ip');
    if (!requestedIp && request.headers.get('content-type')?.includes('application/json')) {
      const body = await request.json().catch(() => ({}));
      if (body.ip) requestedIp = body.ip;
    }
  } catch (e) {
    // Ignore error parsing custom ip
  }

  const detectedIps = getLanIpCandidates();
  const selectedIp = requestedIp || getLanIpAddress();

  // Construct URL for tablet
  let host = request.headers.get('host') || 'localhost:3000';
  const port = host.split(':')[1] || '3000';

  if (selectedIp) {
    host = `${selectedIp}:${port}`;
  } else if (host.startsWith('localhost') || host.startsWith('127.0.0.1')) {
    const lanIp = getLanIpAddress();
    if (lanIp) {
      host = `${lanIp}:${port}`;
    }
  }

  const protocol = host.includes('localhost')
    ? 'http'
    : request.headers.get('x-forwarded-proto') || 'https';
  const targetUrl = `${protocol}://${host}/notebook/${notebookId}/remote-pad?pairing=${pairingCode}`;

  let qrCodeDataUrl = '';
  try {
    qrCodeDataUrl = await QRCode.toDataURL(targetUrl, {
      width: 280,
      margin: 2,
      color: {
        dark: '#1e293b',
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
    expiresAt,
    resolvedIp: selectedIp,
    detectedIps
  });
}
