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
import { subtaskDB } from '@/lib/db';
import { updateSubtaskSchema } from '@/lib/validation';

type RouteContext = { params: Promise<{ id: string }> };

/**
 * Subtask ids are not user-scoped directly — ownership is resolved by walking
 * `subtask -> todo -> user_id`. A subtask on another user's todo must read as 404, not 403.
 */
function assertOwnership(subtaskId: number, userId: number): boolean {
  return subtaskDB.findOwnerUserId(subtaskId) === userId;
}

/** Toggle completion and/or rename a subtask. */
export async function PUT(request: NextRequest, { params }: RouteContext) {
  return withErrorHandling('PUT /api/subtasks/[id]', async () => {
    const session = await getSession();
    if (!session) return unauthorized();

    const { id } = await params;
    const subtaskId = Number(id);
    if (!assertOwnership(subtaskId, session.userId)) return notFound('Subtask not found');

    const parsed = updateSubtaskSchema.safeParse(await readJsonBody(request));
    if (!parsed.success) {
      return badRequest(firstZodMessage(parsed.error));
    }

    const updated = subtaskDB.update(subtaskId, parsed.data);
    if (!updated) return notFound('Subtask not found');

    return NextResponse.json(updated);
  });
}

/** Permanently remove a subtask. Sibling positions are intentionally not renumbered. */
export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  return withErrorHandling('DELETE /api/subtasks/[id]', async () => {
    const session = await getSession();
    if (!session) return unauthorized();

    const { id } = await params;
    const subtaskId = Number(id);
    if (!assertOwnership(subtaskId, session.userId)) return notFound('Subtask not found');

    subtaskDB.delete(subtaskId);
    return NextResponse.json({ success: true });
  });
}
