import { NextResponse } from 'next/server';
import { unauthorized, withErrorHandling } from '@/lib/api-response';
import { getSession } from '@/lib/auth';
import { todoDB } from '@/lib/db';

/**
 * Todos whose reminder window has opened and that have not been notified yet (PRP 04).
 *
 * All timing comparisons happen here, server-side, in Singapore time — the client is purely
 * a polling trigger, so client clock drift cannot make a reminder fire early or late.
 *
 * Reminder windows older than the 24-hour grace period in `findDueReminders` are skipped, so
 * reopening a laptop after a long weekend does not produce a flood of stale notifications.
 */
export async function GET() {
  return withErrorHandling('GET /api/notifications/check', async () => {
    const session = await getSession();
    if (!session) return unauthorized();

    return NextResponse.json({ success: true, data: todoDB.findDueReminders(session.userId) });
  });
}
