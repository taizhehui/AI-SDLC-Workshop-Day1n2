import { NextResponse, type NextRequest } from 'next/server';
import { badRequest, unauthorized, withErrorHandling } from '@/lib/api-response';
import { getSession } from '@/lib/auth';
import { todoDB, type TodoExportItem } from '@/lib/db';
import { importSchema } from '@/lib/validation';

/**
 * Restore todos from a JSON file produced by this app's export.
 *
 * The whole import runs in one transaction: a failure part-way through writes nothing. Import
 * only ever *adds* todos — it never merges with or overwrites existing ones, so importing the
 * same file twice legitimately produces duplicates.
 */
export async function POST(request: NextRequest) {
  return withErrorHandling('POST /api/todos/import', async () => {
    const session = await getSession();
    if (!session) return unauthorized();

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return badRequest('Invalid JSON format');
    }

    const parsed = importSchema.safeParse(body);
    if (!parsed.success) {
      // Deliberately generic: which field failed is not useful to the user and shouldn't
      // describe internal structure back to an arbitrary caller.
      return badRequest('Failed to import todos. Please check the file format.');
    }

    const result = todoDB.importAll(
      session.userId,
      parsed.data.todos as unknown as TodoExportItem[],
    );

    return NextResponse.json({ success: true, ...result });
  });
}
