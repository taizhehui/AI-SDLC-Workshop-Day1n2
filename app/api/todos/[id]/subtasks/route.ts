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
import { subtaskDB, todoDB } from '@/lib/db';
import { createSubtaskSchema } from '@/lib/validation';

type RouteContext = { params: Promise<{ id: string }> };

/** Subtasks of a todo, ordered by position. */
export async function GET(_request: NextRequest, { params }: RouteContext) {
  return withErrorHandling('GET /api/todos/[id]/subtasks', async () => {
    const session = await getSession();
    if (!session) return unauthorized();

    const { id } = await params;
    const todo = todoDB.findById(Number(id), session.userId);
    if (!todo) return notFound('Todo not found');

    return NextResponse.json(subtaskDB.findByTodoId(todo.id));
  });
}

/** Append a subtask; its position is `MAX(position) + 1` for the parent todo. */
export async function POST(request: NextRequest, { params }: RouteContext) {
  return withErrorHandling('POST /api/todos/[id]/subtasks', async () => {
    const session = await getSession();
    if (!session) return unauthorized();

    const { id } = await params;

    // Ownership is inherited from the parent todo; a foreign id must read as "not found".
    const todo = todoDB.findById(Number(id), session.userId);
    if (!todo) return notFound('Todo not found');

    const parsed = createSubtaskSchema.safeParse(await readJsonBody(request));
    if (!parsed.success) {
      return badRequest(firstZodMessage(parsed.error, 'Subtask title is required'));
    }

    const subtask = subtaskDB.create(todo.id, { title: parsed.data.title });
    return NextResponse.json(subtask, { status: 201 });
  });
}
