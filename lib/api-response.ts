import { NextResponse } from 'next/server';
import { ZodError } from 'zod';

/**
 * Uniform API responses and error handling for route handlers.
 *
 * Error bodies are always `{ error: string }` with a message safe to show the user —
 * internal details go to the server log, never to the client
 * (`.claude/rules/security.md`: "Error messages don't leak sensitive data").
 */

export const unauthorized = (): NextResponse =>
  NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

export const notFound = (message = 'Not found'): NextResponse =>
  NextResponse.json({ error: message }, { status: 404 });

export const badRequest = (message: string): NextResponse =>
  NextResponse.json({ error: message }, { status: 400 });

export const conflict = (message: string): NextResponse =>
  NextResponse.json({ error: message }, { status: 409 });

export const serverError = (message = 'Something went wrong'): NextResponse =>
  NextResponse.json({ error: message }, { status: 500 });

/** First validation message from a `ZodError`, or a generic fallback. */
export function firstZodMessage(error: ZodError, fallback = 'Invalid request body'): string {
  return error.issues[0]?.message ?? fallback;
}

/** Parse a JSON request body, returning `undefined` when the body is absent or malformed. */
export async function readJsonBody(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return undefined;
  }
}

/**
 * Wrap a route handler so unexpected exceptions become a logged 500 instead of an unhandled
 * rejection. Validation and ownership failures are still handled explicitly inside handlers.
 */
export async function withErrorHandling<T>(
  context: string,
  handler: () => Promise<T>,
): Promise<T | NextResponse> {
  try {
    return await handler();
  } catch (error) {
    console.error(`${context} failed:`, error);
    return serverError();
  }
}
