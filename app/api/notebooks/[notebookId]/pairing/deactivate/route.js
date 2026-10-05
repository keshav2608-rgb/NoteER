import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import db from '@/lib/db';

export async function POST(request, { params }) {
  try {
    const { notebookId } = params;
    if (!notebookId) {
      return NextResponse.json({ error: 'Missing notebookId' }, { status: 400 });
    }

    // Set all pending or active pairings for this notebook to 'closed'
    await db.run(
      "UPDATE device_pairings SET status = 'closed' WHERE notebook_id = ? AND status != 'closed'",
      [notebookId]
    );

    return NextResponse.json({ success: true, message: 'Notebook pairing session deactivated' });
  } catch (err) {
    console.error('Error deactivating pairing session:', err);
    return NextResponse.json({ error: 'Failed to deactivate session' }, { status: 500 });
  }
}
