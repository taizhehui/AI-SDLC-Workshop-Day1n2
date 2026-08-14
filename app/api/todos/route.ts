import { NextResponse, type NextRequest } from 'next/server';
import {
  badRequest,
  firstZodMessage,
  readJsonBody,
  unauthorized,
  withErrorHandling,
} from '@/lib/api-response';
import { getSession } from '@/lib/auth';
import { todoDB, type Priority, type RecurrencePattern } from '@/lib/db';
import { normalizeDueDate, validateNewTodo } from '@/lib/todo-rules';
import { createTodoSchema } from '@/lib/validation';

/** All todos for the authenticated user, with subtasks and tags joined. */
export async function GET() {
  return withErrorHandling('GET /api/todos', async () => {
    const session = await getSession();
    if (!session) return unauthorized();

    return NextResponse.json(todoDB.findAllWithRelations(session.userId));
  });
}

/** Create a todo. Only `title` is required; everything else falls back to its default. */
export async function POST(request: NextRequest) {
  return withErrorHandling('POST /api/todos', async () => {
    const session = await getSession();
    if (!session) return unauthorized();

    const parsed = createTodoSchema.safeParse(await readJsonBody(request));
    if (!parsed.success) {
      return badRequest(firstZodMessage(parsed.error, 'Title is required'));
    }

    const body = parsed.data;
    const dueDate = normalizeDueDate(body.due_date);
    const isRecurring = body.is_recurring ?? false;
    const pattern = (body.recurrence_pattern ?? null) as RecurrencePattern | null;

    const violation = validateNewTodo({
      due_date: dueDate,
      is_recurring: isRecurring,
      recurrence_pattern: pattern,
      priority: body.priority,
    });
    if (violation) return badRequest(violation.message);

    const todo = todoDB.create(session.userId, {
      title: body.title,
      due_date: dueDate,
      priority: (body.priority ?? 'medium') as Priority,
      is_recurring: isRecurring,
      // Pattern is only meaningful while recurrence is on.
      recurrence_pattern: isRecurring ? pattern : null,
      reminder_minutes: body.reminder_minutes ?? null,
      tag_ids: body.tag_ids ?? [],
    });

    return NextResponse.json(todo, { status: 201 });
  });
}
