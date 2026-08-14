import { NextResponse, type NextRequest } from 'next/server';
import { SESSION_COOKIE, verifySessionToken } from '@/lib/auth';

/**
 * Route protection (PRP 11).
 *
 * Middleware runs on the Edge runtime, so the session cookie is read straight off the
 * request rather than through `next/headers`. Verification uses `jose`, which is
 * Edge-compatible; `lib/db` is deliberately never imported here.
 */
export async function middleware(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const session = await verifySessionToken(token);

  if (!session) {
    const loginUrl = new URL('/login', request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/', '/calendar'],
};
