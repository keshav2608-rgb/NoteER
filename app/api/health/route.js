import { NextResponse } from 'next/server';
import db from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  let dbStatus = 'ok';
  let dbError = null;

  try {
    const res = await db.get('SELECT count(*) as count FROM users');
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
      status: 'ok',
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
    { status: 200 }
  );
}
