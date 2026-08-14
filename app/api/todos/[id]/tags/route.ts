import { NextResponse, type NextRequest } from 'next/server';
import {
  badRequest,
  firstZodMessage,
  notFound,
  readJsonBody,
  unauthorized,
  withErrorHandling,
} from '@/lib/api-response';
import { getSession } from '@/lib/auth';
import { tagDB, todoDB } from '@/lib/db';
import { todoTagSchema } from '@/lib/validation';

type RouteContext = { params: Promise<{ id: string }> };

/**
 * Attach a tag to a todo. Idempotent — re-attaching an already-attached tag is a successful
 * no-op, because rapid pill toggling can fire redundant requests.
 */
export async function POST(request: NextRequest, { params }: RouteContext) {
  return withErrorHandling('POST /api/todos/[id]/tags', async () => {
    const session = await getSession();
    if (!session) return unauthorized();

    const { id } = await params;
    const todo = todoDB.findById(Number(id), session.userId);
    if (!todo) return notFound('Todo not found');

    const parsed = todoTagSchema.safeParse(await readJsonBody(request));
    if (!parsed.success) {
      return badRequest(firstZodMessage(parsed.error, 'tag_id is required'));
    }

    if (!tagDB.attachToTodo(todo.id, parsed.data.tag_id, session.userId)) {
      return notFound('Tag not found');
    }

    return NextResponse.json({ success: true, tags: tagDB.findByTodoId(todo.id) });
  });
}

/** Detach a tag from a todo. Idempotent — detaching a non-attached tag is a no-op. */
export async function DELETE(request: NextRequest, { params }: RouteContext) {
  return withErrorHandling('DELETE /api/todos/[id]/tags', async () => {
    const session = await getSession();
    if (!session) return unauthorized();

    const { id } = await params;
    const todo = todoDB.findById(Number(id), session.userId);
    if (!todo) return notFound('Todo not found');

    const parsed = todoTagSchema.safeParse(await readJsonBody(request));
    if (!parsed.success) {
      return badRequest(firstZodMessage(parsed.error, 'tag_id is required'));
    }

    tagDB.detachFromTodo(todo.id, parsed.data.tag_id);
    return NextResponse.json({ success: true, tags: tagDB.findByTodoId(todo.id) });
  });
}
