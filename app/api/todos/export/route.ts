import { NextResponse, type NextRequest } from 'next/server';
import { unauthorized, withErrorHandling } from '@/lib/api-response';
import { getSession } from '@/lib/auth';
import { todoDB, type Todo, type TodoExport, type TodoExportItem } from '@/lib/db';
import { todosToCsv } from '@/lib/csv';
import { formatSingaporeDate, getSingaporeNow } from '@/lib/timezone';

/**
 * Download all of the user's todos.
 *
 * - `format=json` — complete, nested, versioned, and re-importable.
 * - `format=csv`  — flattened for spreadsheets, one-way only.
 *
 * Filenames are dated in Singapore time, which can differ from the server's UTC calendar date
 * near midnight SGT.
 */
export async function GET(request: NextRequest) {
  return withErrorHandling('GET /api/todos/export', async () => {
    const session = await getSession();
    if (!session) return unauthorized();

    const format = request.nextUrl.searchParams.get('format') ?? 'json';
    const todos = todoDB.findAllWithRelations(session.userId);
    const dateStr = formatSingaporeDate(getSingaporeNow(), 'yyyy-MM-dd');

    if (format === 'csv') {
      return new NextResponse(todosToCsv(todos), {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="todos-${dateStr}.csv"`,
        },
      });
    }

    const payload: TodoExport = {
      version: 1,
      exported_at: formatSingaporeDate(getSingaporeNow(), 'yyyy-MM-ddTHH:mm:ss'),
      todos: todos.map(toExportItem),
    };

    return new NextResponse(JSON.stringify(payload, null, 2), {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="todos-${dateStr}.json"`,
      },
    });
  });
}

/** Strip database identity (`id`, `user_id`) — import always assigns fresh IDs. */
function toExportItem(todo: Todo): TodoExportItem {
  return {
    title: todo.title,
    completed: todo.completed,
    due_date: todo.due_date,
    priority: todo.priority,
    is_recurring: todo.is_recurring,
    recurrence_pattern: todo.recurrence_pattern,
    reminder_minutes: todo.reminder_minutes,
    created_at: todo.created_at,
    subtasks: (todo.subtasks ?? []).map((subtask) => ({
      title: subtask.title,
      completed: subtask.completed,
      position: subtask.position,
    })),
    tags: (todo.tags ?? []).map((tag) => ({ name: tag.name, color: tag.color })),
  };
}
