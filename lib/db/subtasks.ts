import { getDb, toBoolean, toSqliteBoolean } from './client';
import { toSingaporeTimestamp } from '../timezone';
import type { CreateSubtaskDto, Subtask, UpdateSubtaskDto } from './types';

interface SubtaskRow extends Omit<Subtask, 'completed'> {
  completed: number;
}

const mapRow = (row: SubtaskRow): Subtask => ({ ...row, completed: toBoolean(row.completed) });

/** CRUD for the `subtasks` table (PRP 05). Ownership is inherited from the parent todo. */
export const subtaskDB = {
  findById(id: number): Subtask | null {
    const row = getDb().prepare(`SELECT * FROM subtasks WHERE id = ?`).get(id) as
      | SubtaskRow
      | undefined;
    return row ? mapRow(row) : null;
  },

  findByTodoId(todoId: number): Subtask[] {
    const rows = getDb()
      .prepare(`SELECT * FROM subtasks WHERE todo_id = ? ORDER BY position ASC, id ASC`)
      .all(todoId) as SubtaskRow[];
    return rows.map(mapRow);
  },

  /** Batch read for the list endpoint — avoids one query per todo. */
  findByTodoIds(todoIds: number[]): Map<number, Subtask[]> {
    const grouped = new Map<number, Subtask[]>();
    if (todoIds.length === 0) return grouped;

    const placeholders = todoIds.map(() => '?').join(', ');
    const rows = getDb()
      .prepare(
        `SELECT * FROM subtasks
          WHERE todo_id IN (${placeholders})
          ORDER BY todo_id ASC, position ASC, id ASC`,
      )
      .all(...todoIds) as SubtaskRow[];

    for (const row of rows) {
      const bucket = grouped.get(row.todo_id);
      if (bucket) bucket.push(mapRow(row));
      else grouped.set(row.todo_id, [mapRow(row)]);
    }
    return grouped;
  },

  nextPosition(todoId: number): number {
    const row = getDb()
      .prepare(`SELECT COALESCE(MAX(position), -1) AS max_position FROM subtasks WHERE todo_id = ?`)
      .get(todoId) as { max_position: number };
    return (row.max_position ?? -1) + 1;
  },

  create(todoId: number, data: CreateSubtaskDto): Subtask {
    const position = data.position ?? this.nextPosition(todoId);
    const result = getDb()
      .prepare(
        `INSERT INTO subtasks (todo_id, title, completed, position, created_at)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .run(
        todoId,
        data.title,
        toSqliteBoolean(data.completed),
        position,
        toSingaporeTimestamp(),
      );

    const created = this.findById(Number(result.lastInsertRowid));
    if (!created) {
      throw new Error('Failed to create subtask');
    }
    return created;
  },

  update(id: number, data: UpdateSubtaskDto): Subtask | null {
    const existing = this.findById(id);
    if (!existing) return null;

    const assignments: string[] = [];
    const values: Array<string | number> = [];

    if (data.title !== undefined) {
      assignments.push('title = ?');
      values.push(data.title);
    }
    if (data.completed !== undefined) {
      assignments.push('completed = ?');
      values.push(toSqliteBoolean(data.completed));
    }

    if (assignments.length === 0) return existing;

    values.push(id);
    getDb()
      .prepare(`UPDATE subtasks SET ${assignments.join(', ')} WHERE id = ?`)
      .run(...values);

    return this.findById(id);
  },

  /**
   * Deletes one row without compacting sibling `position` values — ordering only needs
   * `ORDER BY position ASC` to be stable, so gaps are harmless and deletes stay O(1).
   */
  delete(id: number): void {
    getDb().prepare(`DELETE FROM subtasks WHERE id = ?`).run(id);
  },

  /** Resolves the owning user for an ownership check (`subtask -> todo -> user_id`). */
  findOwnerUserId(subtaskId: number): number | null {
    const row = getDb()
      .prepare(
        `SELECT todos.user_id AS user_id
           FROM subtasks
           JOIN todos ON todos.id = subtasks.todo_id
          WHERE subtasks.id = ?`,
      )
      .get(subtaskId) as { user_id: number } | undefined;
    return row?.user_id ?? null;
  },
};
