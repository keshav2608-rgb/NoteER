import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const googleClientId =
    process.env.GOOGLE_CLIENT_ID ||
    process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ||
    '';

  const isDemoEnabled =
    process.env.ENABLE_DEMO_AUTH === 'true' ||
    (process.env.NODE_ENV !== 'production' && process.env.ENABLE_DEMO_AUTH !== 'false');

  return NextResponse.json({
    googleClientId,
    isDemoEnabled
  });
}
