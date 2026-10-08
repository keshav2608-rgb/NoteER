import { NextResponse } from 'next/server';

// Lightweight in-memory rate limiting map: ip -> { count, resetTime }
const rateLimitMap = new Map();

function checkRateLimit(ip, limit = 20, windowMs = 60000) {
  const now = Date.now();
  const record = rateLimitMap.get(ip) || { count: 0, resetTime: now + windowMs };

  if (now > record.resetTime) {
    record.count = 1;
    record.resetTime = now + windowMs;
    rateLimitMap.set(ip, record);
    return { allowed: true, remaining: limit - 1, resetIn: windowMs };
  }

  record.count += 1;
  rateLimitMap.set(ip, record);

  if (record.count > limit) {
    return { allowed: false, remaining: 0, resetIn: Math.ceil((record.resetTime - now) / 1000) };
  }

  return { allowed: true, remaining: limit - record.count, resetIn: Math.ceil((record.resetTime - now) / 1000) };
}

// Cleanup stale IP entries every 5 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [key, val] of rateLimitMap.entries()) {
      if (now > val.resetTime + 60000) {
        rateLimitMap.delete(key);
      }
    }
  }, 300000);
}

export function middleware(request) {
  const { pathname } = request.nextUrl;
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.ip ||
    '127.0.0.1';

  // 1. Maintenance Mode
  if (process.env.MAINTENANCE_MODE === 'true') {
    if (
      pathname.startsWith('/_next') ||
      pathname.startsWith('/api/health') ||
      pathname === '/favicon.ico'
    ) {
      return NextResponse.next();
    }

    return new NextResponse(
      `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Under Maintenance | NoteV1</title>
  <style>
    body {
      margin: 0;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      background: #0f172a;
      color: #f8fafc;
      text-align: center;
      padding: 24px;
      box-sizing: border-box;
    }
    .card {
      max-width: 480px;
      padding: 40px 32px;
      background: #1e293b;
      border-radius: 16px;
      border: 1px solid #334155;
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5);
    }
    .badge {
      display: inline-block;
      padding: 6px 14px;
      background: rgba(56, 189, 248, 0.1);
      border: 1px solid rgba(56, 189, 248, 0.3);
      border-radius: 9999px;
      color: #38bdf8;
      font-size: 13px;
      font-weight: 500;
      margin-bottom: 20px;
    }
    h1 {
      font-size: 24px;
      margin: 0 0 12px 0;
      color: #f8fafc;
    }
    p {
      color: #94a3b8;
      line-height: 1.6;
      font-size: 15px;
      margin: 0;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="badge">&#128736; Scheduled Maintenance</div>
    <h1>We&#39;ll be right back</h1>
    <p>NoteV1 is currently undergoing scheduled maintenance and updates. We&#39;ll be back online shortly. Thank you for your patience!</p>
  </div>
</body>
</html>`,
      {
        status: 503,
        headers: {
          'content-type': 'text/html; charset=utf-8',
          'Retry-After': '1800'
        }
      }
    );
  }

  // 2. Rate Limiting on sensitive routes. Only credential-exchanging endpoints
  // are limited; /api/auth/me and /api/auth/config run on every page load.
  if (pathname === '/api/auth/demo' || pathname === '/api/auth/google') {
    const { allowed, resetIn } = checkRateLimit(`auth_${ip}`, 30, 60000);
    if (!allowed) {
      return NextResponse.json(
        { error: 'Too many authentication attempts. Please try again later.' },
        { status: 429, headers: { 'Retry-After': String(resetIn) } }
      );
    }
  }

  if (pathname.startsWith('/api/pairing/verify')) {
    const { allowed, resetIn } = checkRateLimit(`pairing_${ip}`, 15, 60000);
    if (!allowed) {
      return NextResponse.json(
        { error: 'Too many pairing attempts. Please wait a minute.' },
        { status: 429, headers: { 'Retry-After': String(resetIn) } }
      );
    }
  }

  // 3. Server-Side Route Protection for Dashboard & Notebooks
  const isDashboardRoute = pathname === '/dashboard' || pathname.startsWith('/dashboard/');
  const isNotebookRoute = pathname.startsWith('/notebook/') && !pathname.includes('/remote-pad');

  if (isDashboardRoute || isNotebookRoute) {
    const sessionCookie = request.cookies.get('notebook_session_token')?.value;
    if (!sessionCookie) {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('redirect', pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  // 3. CSRF Protection for API mutations
  const isMutation = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method);
  if (isMutation && pathname.startsWith('/api/') && !pathname.startsWith('/api/collab/')) {
    const origin = request.headers.get('origin');
    const host = request.headers.get('host');
    if (origin && host) {
      try {
        const originHost = new URL(origin).host;
        // Allow same host, localhost, or deployment domains
        const isAllowedOrigin =
          originHost === host ||
          originHost.includes('localhost') ||
          originHost.includes('127.0.0.1') ||
          originHost.endsWith('.vercel.app') ||
          originHost.endsWith('.onrender.com');

        if (!isAllowedOrigin) {
          return NextResponse.json({ error: 'Cross-origin request rejected' }, { status: 403 });
        }
      } catch {
        return NextResponse.json({ error: 'Malformed request origin' }, { status: 400 });
      }
    }
  }

  // 4. Inject Security Headers
  const response = NextResponse.next();
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'SAMEORIGIN');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
