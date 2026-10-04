import { NextResponse } from 'next/server';

export function middleware(request) {
  if (process.env.MAINTENANCE_MODE === 'true') {
    const { pathname } = request.nextUrl;

    // Allow static assets, internal Next.js files, and the health check probe
    if (
      pathname.startsWith('/_next') ||
      pathname.startsWith('/api/health') ||
      pathname === '/favicon.ico'
    ) {
      return NextResponse.next();
    }

    // Return a clean, responsive maintenance screen with HTTP 503 Service Unavailable
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

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
