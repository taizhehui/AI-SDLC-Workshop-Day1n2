import { getDb, toBoolean, toSqliteBoolean } from './client';
import { toSingaporeTimestamp } from '../timezone';
import {
  parseTemplateSubtasks,
  serializeTemplateSubtasks,
} from '../template-subtasks';
import type { CreateTemplateDto, Template, UpdateTemplateDto } from './types';

// Re-exported so server code can keep reaching them through `@/lib/db`, while client
// components import the same pure helpers directly from `@/lib/template-subtasks`.
export { parseTemplateSubtasks, serializeTemplateSubtasks };

interface TemplateRow extends Omit<Template, 'is_recurring'> {
  is_recurring: number;
}

const mapRow = (row: TemplateRow): Template => ({
  ...row,
  is_recurring: toBoolean(row.is_recurring),
  reminder_minutes: row.reminder_minutes ?? null,
  due_date_offset_minutes: row.due_date_offset_minutes ?? null,
});

/** CRUD for the `templates` table (PRP 07). Templates are a snapshot, never a live link. */
export const templateDB = {
  findAllByUser(userId: number): Template[] {
    const rows = getDb()
      .prepare(`SELECT * FROM templates WHERE user_id = ? ORDER BY created_at DESC, id DESC`)
      .all(userId) as TemplateRow[];
    return rows.map(mapRow);
  },

  findById(id: number, userId?: number): Template | null {
    const row =
      userId === undefined
        ? (getDb().prepare(`SELECT * FROM templates WHERE id = ?`).get(id) as
            | TemplateRow
            | undefined)
        : (getDb()
            .prepare(`SELECT * FROM templates WHERE id = ? AND user_id = ?`)
            .get(id, userId) as TemplateRow | undefined);
    return row ? mapRow(row) : null;
  },

  create(userId: number, input: CreateTemplateDto): Template {
    const result = getDb()
      .prepare(
        `INSERT INTO templates
           (user_id, name, description, category, title_template, priority, is_recurring,
            recurrence_pattern, reminder_minutes, due_date_offset_minutes, subtasks_json, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        userId,
        input.name,
        input.description ?? null,
        input.category ?? null,
        input.title_template,
        input.priority ?? 'medium',
        toSqliteBoolean(input.is_recurring),
        input.recurrence_pattern ?? null,
        input.reminder_minutes ?? null,
        input.due_date_offset_minutes ?? null,
        serializeTemplateSubtasks(input.subtasks),
        toSingaporeTimestamp(),
      );

    const created = this.findById(Number(result.lastInsertRowid), userId);
    if (!created) {
      throw new Error('Failed to create template');
    }
    return created;
  },

  update(id: number, userId: number, input: UpdateTemplateDto): Template | null {
    const existing = this.findById(id, userId);
    if (!existing) return null;

    const assignments: string[] = [];
    const values: Array<string | number | null> = [];

    const push = (column: string, value: string | number | null) => {
      assignments.push(`${column} = ?`);
      values.push(value);
    };

    if (input.name !== undefined) push('name', input.name);
    if (input.description !== undefined) push('description', input.description ?? null);
    if (input.category !== undefined) push('category', input.category ?? null);
    if (input.title_template !== undefined) push('title_template', input.title_template);
    if (input.priority !== undefined) push('priority', input.priority);
    if (input.is_recurring !== undefined) {
      push('is_recurring', toSqliteBoolean(input.is_recurring));
    }
    if (input.recurrence_pattern !== undefined) {
      push('recurrence_pattern', input.recurrence_pattern ?? null);
    }
    if (input.reminder_minutes !== undefined) {
      push('reminder_minutes', input.reminder_minutes ?? null);
    }
    if (input.due_date_offset_minutes !== undefined) {
      push('due_date_offset_minutes', input.due_date_offset_minutes ?? null);
    }
    if (input.subtasks !== undefined) {
      push('subtasks_json', serializeTemplateSubtasks(input.subtasks));
    }

    if (assignments.length === 0) return existing;

    getDb()
      .prepare(`UPDATE templates SET ${assignments.join(', ')} WHERE id = ? AND user_id = ?`)
      .run(...values, id, userId);

    return this.findById(id, userId);
  },

  /** Deleting a template never touches todos created from it — there is no FK between them. */
  delete(id: number, userId: number): boolean {
    const result = getDb()
      .prepare(`DELETE FROM templates WHERE id = ? AND user_id = ?`)
      .run(id, userId);
    return result.changes > 0;
  },
};
