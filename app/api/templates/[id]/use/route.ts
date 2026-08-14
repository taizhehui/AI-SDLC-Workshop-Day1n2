import { NextResponse, type NextRequest } from 'next/server';
import { notFound, unauthorized, withErrorHandling } from '@/lib/api-response';
import { getSession } from '@/lib/auth';
import { parseTemplateSubtasks, subtaskDB, templateDB, todoDB } from '@/lib/db';
import { addSingaporeMinutes, getSingaporeNow } from '@/lib/timezone';

type RouteContext = { params: Promise<{ id: string }> };

/**
 * Instantiate a todo (plus its checklist) from a template.
 *
 * The due date is resolved from the stored relative offset at use time, in Singapore time.
 * Templates never carry tags, so the created todo starts untagged regardless of what the
 * original draft had selected.
 */
export async function POST(_request: NextRequest, { params }: RouteContext) {
  return withErrorHandling('POST /api/templates/[id]/use', async () => {
    const session = await getSession();
    if (!session) return unauthorized();

    const { id } = await params;
    const template = templateDB.findById(Number(id), session.userId);
    if (!template) return notFound('Template not found');

    const dueDate =
      template.due_date_offset_minutes != null
        ? addSingaporeMinutes(getSingaporeNow(), template.due_date_offset_minutes)
        : null;

    const todo = todoDB.create(session.userId, {
      title: template.title_template,
      priority: template.priority,
      due_date: dueDate,
      // Recurrence needs a due date anchor; a template without an offset cannot supply one.
      is_recurring: template.is_recurring && dueDate !== null,
      recurrence_pattern: dueDate !== null ? template.recurrence_pattern : null,
      reminder_minutes: template.reminder_minutes ?? null,
    });

    // Malformed subtasks_json degrades to an empty checklist rather than failing the request.
    for (const subtask of parseTemplateSubtasks(template.subtasks_json)) {
      subtaskDB.create(todo.id, { title: subtask.title, position: subtask.position });
    }

    const created = todoDB.findByIdWithRelations(todo.id, session.userId);
    return NextResponse.json(created, { status: 201 });
  });
}
