import { NextResponse, type NextRequest } from 'next/server';
import {
  badRequest,
  firstZodMessage,
  readJsonBody,
  unauthorized,
  withErrorHandling,
} from '@/lib/api-response';
import { getSession } from '@/lib/auth';
import { templateDB, type RecurrencePattern } from '@/lib/db';
import { createTemplateSchema } from '@/lib/validation';

/** All templates owned by the authenticated user. */
export async function GET() {
  return withErrorHandling('GET /api/templates', async () => {
    const session = await getSession();
    if (!session) return unauthorized();

    return NextResponse.json(templateDB.findAllByUser(session.userId));
  });
}

/**
 * Save a todo-form state as a reusable pattern.
 *
 * Templates deliberately store no concrete due date (only a relative offset) and no tags —
 * both are instance-specific.
 */
export async function POST(request: NextRequest) {
  return withErrorHandling('POST /api/templates', async () => {
    const session = await getSession();
    if (!session) return unauthorized();

    const parsed = createTemplateSchema.safeParse(await readJsonBody(request));
    if (!parsed.success) {
      return badRequest(firstZodMessage(parsed.error, 'Name and title are required'));
    }

    const body = parsed.data;
    const isRecurring = body.is_recurring ?? false;

    // Enforce PRP 03's "recurring needs an anchor date" invariant at save time rather than
    // letting a template create an invalid todo later.
    if (isRecurring && body.due_date_offset_minutes == null) {
      return badRequest('Recurring templates require a due date offset');
    }
    if (isRecurring && !body.recurrence_pattern) {
      return badRequest('Invalid recurrence pattern');
    }

    const template = templateDB.create(session.userId, {
      name: body.name,
      description: body.description ?? null,
      category: body.category ?? null,
      title_template: body.title_template,
      priority: body.priority ?? 'medium',
      is_recurring: isRecurring,
      recurrence_pattern: isRecurring
        ? ((body.recurrence_pattern ?? null) as RecurrencePattern | null)
        : null,
      reminder_minutes: body.reminder_minutes ?? null,
      due_date_offset_minutes: body.due_date_offset_minutes ?? null,
      subtasks: body.subtasks?.map((subtask, index) => ({
        title: subtask.title,
        position: subtask.position ?? index,
      })),
    });

    return NextResponse.json(template, { status: 201 });
  });
}
