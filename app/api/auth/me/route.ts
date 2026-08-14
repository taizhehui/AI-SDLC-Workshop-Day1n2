import { NextResponse } from 'next/server';
import { unauthorized, withErrorHandling } from '@/lib/api-response';
import { getSession } from '@/lib/auth';
import { userDB } from '@/lib/db';

/** The current session's user, or 401. Used by `/login` to bounce already-signed-in users. */
export async function GET() {
  return withErrorHandling('GET /api/auth/me', async () => {
    const session = await getSession();
    if (!session) return unauthorized();

    const user = userDB.findById(session.userId);
    if (!user) return unauthorized();

    return NextResponse.json({ user });
  });
}
