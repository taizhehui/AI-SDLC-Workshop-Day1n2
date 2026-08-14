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
import { templateDB } from '@/lib/db';
import { updateTemplateSchema } from '@/lib/validation';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: RouteContext) {
  return withErrorHandling('GET /api/templates/[id]', async () => {
    const session = await getSession();
    if (!session) return unauthorized();

    const { id } = await params;
    const template = templateDB.findById(Number(id), session.userId);
    if (!template) return notFound('Template not found');

    return NextResponse.json(template);
  });
}

export async function PUT(request: NextRequest, { params }: RouteContext) {
  return withErrorHandling('PUT /api/templates/[id]', async () => {
    const session = await getSession();
    if (!session) return unauthorized();

    const { id } = await params;
    const parsed = updateTemplateSchema.safeParse(await readJsonBody(request));
    if (!parsed.success) {
      return badRequest(firstZodMessage(parsed.error));
    }

    const updated = templateDB.update(Number(id), session.userId, {
      ...parsed.data,
      subtasks: parsed.data.subtasks?.map((subtask, index) => ({
        title: subtask.title,
        position: subtask.position ?? index,
      })),
    });
    if (!updated) return notFound('Template not found');

    return NextResponse.json(updated);
  });
}

/** Delete a template. Todos previously created from it are untouched — there is no FK. */
export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  return withErrorHandling('DELETE /api/templates/[id]', async () => {
    const session = await getSession();
    if (!session) return unauthorized();

    const { id } = await params;
    const deleted = templateDB.delete(Number(id), session.userId);
    if (!deleted) return notFound('Template not found');

    return NextResponse.json({ success: true });
  });
}
