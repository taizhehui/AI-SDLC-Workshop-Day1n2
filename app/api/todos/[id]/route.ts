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
import { tagDB, todoDB, type RecurrencePattern, type Todo } from '@/lib/db';
import { calculateNextDueDate } from '@/lib/recurrence';
import {
  isCompletionTransition,
  normalizeDueDate,
  resolveUpdatedRecurrence,
  shouldSpawnNextInstance,
  validateRecurrence,
} from '@/lib/todo-rules';
import { updateTodoSchema } from '@/lib/validation';

type RouteContext = { params: Promise<{ id: string }> };

/** A single todo, or 404 when it does not exist **or** belongs to another user. */
export async function GET(_request: NextRequest, { params }: RouteContext) {
  return withErrorHandling('GET /api/todos/[id]', async () => {
    const session = await getSession();
    if (!session) return unauthorized();

    const { id } = await params;
    const todo = todoDB.findByIdWithRelations(Number(id), session.userId);
    if (!todo) return notFound('Todo not found');

    return NextResponse.json(todo);
  });
}

/**
 * Update any subset of fields.
 *
 * Completing a recurring todo also creates the next occurrence in the same request, so the
 * client can render it immediately without a second round trip.
 */
export async function PUT(request: NextRequest, { params }: RouteContext) {
  return withErrorHandling('PUT /api/todos/[id]', async () => {
    const session = await getSession();
    if (!session) return unauthorized();

    const { id } = await params;
    const todoId = Number(id);

    // 404 rather than 403 on a cross-user id, so todo ids of other users stay unguessable.
    const existing = todoDB.findById(todoId, session.userId);
    if (!existing) return notFound('Todo not found');

    const parsed = updateTodoSchema.safeParse(await readJsonBody(request));
    if (!parsed.success) {
      return badRequest(firstZodMessage(parsed.error));
    }

    const body = parsed.data;
    const patch = {
      ...body,
      due_date: body.due_date !== undefined ? normalizeDueDate(body.due_date) : undefined,
      recurrence_pattern: (body.recurrence_pattern ?? null) as RecurrencePattern | null,
    };

    // Recurrence is validated against the merged post-update state, since an update can
    // switch recurrence on without restating the due date.
    const merged = resolveUpdatedRecurrence(existing, {
      is_recurring: body.is_recurring,
      recurrence_pattern:
        body.recurrence_pattern !== undefined ? patch.recurrence_pattern : undefined,
      due_date: patch.due_date,
    });
    const violation = validateRecurrence(merged.isRecurring, merged.pattern, merged.dueDate);
    if (violation) return badRequest(violation.message);

    const updated = todoDB.update(todoId, session.userId, {
      ...patch,
      recurrence_pattern:
        body.recurrence_pattern !== undefined || body.is_recurring !== undefined
          ? merged.isRecurring
            ? merged.pattern
            : null
          : undefined,
      is_recurring: body.is_recurring,
    });
    if (!updated) return notFound('Todo not found');

    const nextInstance = maybeCreateNextInstance(existing, body.completed, session.userId);

    return NextResponse.json({ todo: updated, nextInstance });
  });
}

/** Delete a todo. FK CASCADE removes its subtasks and tag links. No confirmation step. */
export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  return withErrorHandling('DELETE /api/todos/[id]', async () => {
    const session = await getSession();
    if (!session) return unauthorized();

    const { id } = await params;
    const deleted = todoDB.delete(Number(id), session.userId);
    if (!deleted) return notFound('Todo not found');

    return NextResponse.json({ success: true });
  });
}

/**
 * Spawn the next occurrence of a recurring todo, but only on a genuine `false -> true`
 * completion transition — a repeated completion PUT is a no-op here.
 *
 * The new instance inherits the values in effect **at completion time**, not the values the
 * chain started with.
 */
function maybeCreateNextInstance(
  existing: Todo,
  patchCompleted: boolean | undefined,
  userId: number,
): Todo | null {
  if (!isCompletionTransition(existing, patchCompleted)) return null;
  if (!shouldSpawnNextInstance(existing)) return null;

  const nextDueDate = calculateNextDueDate(
    existing.due_date as string,
    existing.recurrence_pattern as RecurrencePattern,
  );

  return todoDB.create(userId, {
    title: existing.title,
    priority: existing.priority,
    due_date: nextDueDate,
    is_recurring: true,
    recurrence_pattern: existing.recurrence_pattern,
    reminder_minutes: existing.reminder_minutes ?? null,
    tag_ids: tagDB.getTagIdsForTodo(existing.id),
  });
}
