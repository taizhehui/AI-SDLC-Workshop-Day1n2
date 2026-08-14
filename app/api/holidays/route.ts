import { NextResponse, type NextRequest } from 'next/server';
import { unauthorized, withErrorHandling } from '@/lib/api-response';
import { getSession } from '@/lib/auth';
import { holidayDB } from '@/lib/db';

/**
 * Singapore public holidays, optionally scoped to a calendar month.
 *
 * Holiday data is global rather than user-scoped, but the route still requires a session so
 * the API surface stays uniform.
 */
export async function GET(request: NextRequest) {
  return withErrorHandling('GET /api/holidays', async () => {
    const session = await getSession();
    if (!session) return unauthorized();

    const { searchParams } = new URL(request.url);
    const year = Number(searchParams.get('year'));
    const month = Number(searchParams.get('month'));

    const scoped =
      Number.isInteger(year) && year > 0 && Number.isInteger(month) && month >= 1 && month <= 12;

    const holidays = scoped ? holidayDB.findByMonth(year, month) : holidayDB.findAll();
    return NextResponse.json({ holidays });
  });
}
