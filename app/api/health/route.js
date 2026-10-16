import { NextResponse } from 'next/server';
import db from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  // Liveness probe (default, used by Render / uptime bots): does not touch the database,
  // so a slow or briefly-down DB can never make the web service itself look "down".
  // Use /api/health?deep=1 to also verify database connectivity.
  const deep = new URL(request.url).searchParams.get('deep');
  if (!deep) {
    return NextResponse.json(
      { status: 'ok', service: 'collaborative-notebook-web', uptime: process.uptime() },
      { status: 200 }
    );
  }

  let dbStatus = 'ok';
  let dbError = null;

  try {
    const res = await Promise.race([
      db.get('SELECT count(*) as count FROM users'),
      new Promise((_, reject) => setTimeout(() => reject(new Error('DB health check timed out')), 5000))
    ]);
    dbStatus = 'connected (' + (process.env.DATABASE_URL ? 'postgresql' : 'sqlite') + '), count: ' + (res?.count || 0);
  } catch (err) {
    dbStatus = 'error';
    dbError = {
      message: err.message,
      name: err.name,
      stack: err.stack?.split('\n').slice(0, 3).join(' | ')
    };
  }

  return NextResponse.json(
    {
      status: dbError ? 'degraded' : 'ok',
      service: 'collaborative-notebook-web',
      nodeVersion: process.version,
      hasDatabaseUrl: Boolean(process.env.DATABASE_URL),
      database: {
        status: dbStatus,
        error: dbError
      },
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    },
    { status: dbError ? 503 : 200 }
  );
}
