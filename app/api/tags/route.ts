import { NextResponse, type NextRequest } from 'next/server';
import {
  badRequest,
  conflict,
  firstZodMessage,
  readJsonBody,
  unauthorized,
  withErrorHandling,
} from '@/lib/api-response';
import { getSession } from '@/lib/auth';
import { DEFAULT_TAG_COLOR, tagDB } from '@/lib/db';
import { createTagSchema } from '@/lib/validation';

/** All tags owned by the authenticated user. */
export async function GET() {
  return withErrorHandling('GET /api/tags', async () => {
    const session = await getSession();
    if (!session) return unauthorized();

    return NextResponse.json(tagDB.findAllByUser(session.userId));
  });
}

/**
 * Create a tag. Names are unique per user; the `UNIQUE(user_id, name)` constraint is the
 * backstop, surfaced as a 409 rather than an unhandled 500.
 */
export async function POST(request: NextRequest) {
  return withErrorHandling('POST /api/tags', async () => {
    const session = await getSession();
    if (!session) return unauthorized();

    const parsed = createTagSchema.safeParse(await readJsonBody(request));
    if (!parsed.success) {
      return badRequest(firstZodMessage(parsed.error, 'Tag name is required'));
    }

    const { name, color } = parsed.data;

    try {
      const tag = tagDB.create(session.userId, { name, color: color ?? DEFAULT_TAG_COLOR });
      return NextResponse.json(tag, { status: 201 });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (/UNIQUE constraint failed/i.test(message)) {
        return conflict('A tag with this name already exists');
      }
      throw error;
    }
  });
}
