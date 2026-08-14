import { cookies } from 'next/headers';
import { SignJWT, jwtVerify } from 'jose';
import type { Session, User } from './db/types';

/**
 * JWT-backed session handling (PRP 11).
 *
 * The token is stored in an HTTP-only cookie so client JavaScript can never read it, and
 * every read path fails closed — an expired, tampered, or absent token yields `null` rather
 * than an exception, so middleware and API routes uniformly treat it as unauthenticated.
 */

export const SESSION_COOKIE = 'todo_session';
export const SESSION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60; // 7 days

const DEV_FALLBACK_SECRET = 'todo-app-development-secret-change-me-please-32chars';

let cachedSecret: Uint8Array | null = null;

function getSecretKey(): Uint8Array {
  if (cachedSecret) return cachedSecret;

  const secret = process.env.JWT_SECRET?.trim();

  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('JWT_SECRET is not configured');
    }
    console.warn('JWT_SECRET is not set — using an insecure development fallback.');
    cachedSecret = new TextEncoder().encode(DEV_FALLBACK_SECRET);
    return cachedSecret;
  }

  if (secret.length < 32) {
    throw new Error('JWT_SECRET must be at least 32 characters');
  }

  cachedSecret = new TextEncoder().encode(secret);
  return cachedSecret;
}

/** Sign a session token for the user. Exported for middleware and unit tests. */
export async function signSessionToken(session: Session): Promise<string> {
  return new SignJWT({ userId: session.userId, username: session.username })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE_SECONDS}s`)
    .sign(getSecretKey());
}

/** Verify a session token. Returns `null` for absent, malformed, tampered, or expired tokens. */
export async function verifySessionToken(token: string | undefined): Promise<Session | null> {
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, getSecretKey(), { algorithms: ['HS256'] });
    const userId = payload.userId;
    const username = payload.username;

    if (typeof userId !== 'number' || typeof username !== 'string') return null;
    return { userId, username };
  } catch {
    return null;
  }
}

/** Sign a JWT for the user and set it as an HTTP-only cookie with a 7-day expiry. */
export async function createSession(user: User): Promise<void> {
  const token = await signSessionToken({ userId: user.id, username: user.username });
  const cookieStore = await cookies();

  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

/**
 * The current session, or `null`. Called first in every protected API route:
 * `const session = await getSession(); if (!session) return 401;`
 */
export async function getSession(): Promise<Session | null> {
  try {
    const cookieStore = await cookies();
    return await verifySessionToken(cookieStore.get(SESSION_COOKIE)?.value);
  } catch {
    return null;
  }
}

/** Clear the session cookie (logout). */
export async function deleteSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}
