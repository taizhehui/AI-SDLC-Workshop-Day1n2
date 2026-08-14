import { NextResponse } from 'next/server';
import { withErrorHandling } from '@/lib/api-response';
import { deleteSession } from '@/lib/auth';

/** Clear the session cookie. Subsequent requests are treated as unauthenticated. */
export async function POST() {
  return withErrorHandling('POST /api/auth/logout', async () => {
    await deleteSession();
    return NextResponse.json({ success: true });
  });
}
