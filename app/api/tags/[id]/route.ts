import { NextResponse, type NextRequest } from 'next/server';
import {
  badRequest,
  conflict,
  firstZodMessage,
  notFound,
  readJsonBody,
  unauthorized,
  withErrorHandling,
} from '@/lib/api-response';
import { getSession } from '@/lib/auth';
import { tagDB } from '@/lib/db';
import { updateTagSchema } from '@/lib/validation';

type RouteContext = { params: Promise<{ id: string }> };

/**
 * Rename and/or recolor a tag. The change propagates to every todo carrying it, since tags
 * are looked up live rather than copied onto the todo.
 */
export async function PUT(request: NextRequest, { params }: RouteContext) {
  return withErrorHandling('PUT /api/tags/[id]', async () => {
    const session = await getSession();
    if (!session) return unauthorized();

    const { id } = await params;
    const parsed = updateTagSchema.safeParse(await readJsonBody(request));
    if (!parsed.success) {
      return badRequest(firstZodMessage(parsed.error));
    }

    try {
      const updated = tagDB.update(Number(id), session.userId, parsed.data);
      if (!updated) return notFound('Tag not found');
      return NextResponse.json(updated);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (/UNIQUE constraint failed/i.test(message)) {
        return conflict('A tag with this name already exists');
      }
      throw error;
    }
  });
}

/** Delete a tag. CASCADE removes its `todo_tags` rows in the same operation. */
export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  return withErrorHandling('DELETE /api/tags/[id]', async () => {
    const session = await getSession();
    if (!session) return unauthorized();

    const { id } = await params;
    const deleted = tagDB.delete(Number(id), session.userId);
    if (!deleted) return notFound('Tag not found');

    return NextResponse.json({ success: true });
  });
}
