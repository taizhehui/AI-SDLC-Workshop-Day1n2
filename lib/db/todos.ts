import { getDb, toBoolean, toSqliteBoolean } from './client';
import { subtaskDB } from './subtasks';
import { tagDB } from './tags';
import { formatSingaporeDate, getSingaporeNow, toSingaporeTimestamp } from '../timezone';
import type {
  CreateTodoInput,
  ImportResult,
  Todo,
  TodoExportItem,
  UpdateTodoInput,
} from './types';

interface TodoRow extends Omit<Todo, 'completed' | 'is_recurring' | 'subtasks' | 'tags'> {
  completed: number;
  is_recurring: number;
}

const mapRow = (row: TodoRow): Todo => ({
  ...row,
  completed: toBoolean(row.completed),
  is_recurring: toBoolean(row.is_recurring),
  reminder_minutes: row.reminder_minutes ?? null,
  last_notification_sent: row.last_notification_sent ?? null,
});

/** Columns a `PUT` may write, mapped to their SQL-value coercion. */
const UPDATABLE_COLUMNS = {
  title: (value: unknown) => value as string,
  completed: (value: unknown) => toSqliteBoolean(value as boolean),
  due_date: (value: unknown) => (value as string | null) ?? null,
  priority: (value: unknown) => value as string,
  is_recurring: (value: unknown) => toSqliteBoolean(value as boolean),
  recurrence_pattern: (value: unknown) => (value as string | null) ?? null,
  reminder_minutes: (value: unknown) => (value as number | null) ?? null,
  last_notification_sent: (value: unknown) => (value as string | null) ?? null,
} as const;

type UpdatableColumn = keyof typeof UPDATABLE_COLUMNS;

/** CRUD for the `todos` table (PRP 01), plus relation loading and bulk import (PRP 09). */
export const todoDB = {
  findById(id: number, userId?: number): Todo | null {
    const row =
      userId === undefined
        ? (getDb().prepare(`SELECT * FROM todos WHERE id = ?`).get(id) as TodoRow | undefined)
        : (getDb()
            .prepare(`SELECT * FROM todos WHERE id = ? AND user_id = ?`)
            .get(id, userId) as TodoRow | undefined);
    return row ? mapRow(row) : null;
  },

  /** Single todo with its subtasks and tags attached. */
  findByIdWithRelations(id: number, userId?: number): Todo | null {
    const todo = this.findById(id, userId);
    if (!todo) return null;
    return {
      ...todo,
      subtasks: subtaskDB.findByTodoId(todo.id),
      tags: tagDB.findByTodoId(todo.id),
    };
  },

  findAllByUser(userId: number): Todo[] {
    const rows = getDb()
      .prepare(`SELECT * FROM todos WHERE user_id = ? ORDER BY id ASC`)
      .all(userId) as TodoRow[];
    return rows.map(mapRow);
  },

  /**
   * Every todo for the user with subtasks and tags joined — three queries total regardless
   * of list size. This is what `GET /api/todos` returns.
   */
  findAllWithRelations(userId: number): Todo[] {
    const todos = this.findAllByUser(userId);
    if (todos.length === 0) return [];

    const ids = todos.map((todo) => todo.id);
    const subtasksByTodo = subtaskDB.findByTodoIds(ids);
    const tagsByTodo = tagDB.findByTodoIds(ids);

    return todos.map((todo) => ({
      ...todo,
      subtasks: subtasksByTodo.get(todo.id) ?? [],
      tags: tagsByTodo.get(todo.id) ?? [],
    }));
  },

  create(userId: number, input: CreateTodoInput): Todo {
    const db = getDb();
    const now = toSingaporeTimestamp();

    const insert = db.transaction((): number => {
      const result = db
        .prepare(
          `INSERT INTO todos
             (user_id, title, completed, due_date, priority, is_recurring,
              recurrence_pattern, reminder_minutes, last_notification_sent, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, NULL)`,
        )
        .run(
          userId,
          input.title,
          toSqliteBoolean(input.completed),
          input.due_date ?? null,
          input.priority ?? 'medium',
          toSqliteBoolean(input.is_recurring),
          input.recurrence_pattern ?? null,
          input.reminder_minutes ?? null,
          input.created_at ?? now,
        );

      const todoId = Number(result.lastInsertRowid);
      if (input.tag_ids?.length) {
        tagDB.setTodoTags(todoId, input.tag_ids, userId);
      }
      return todoId;
    });

    const created = this.findByIdWithRelations(insert(), userId);
    if (!created) {
      throw new Error('Failed to create todo');
    }
    return created;
  },

  /**
   * Partial update. Returns `null` when the todo does not exist or is not owned by `userId`.
   *
   * Changing `due_date` or `reminder_minutes` clears `last_notification_sent` so the reminder
   * re-arms for the new window (PRP 04) — unless the caller is explicitly setting that stamp.
   */
  update(id: number, userId: number, input: UpdateTodoInput): Todo | null {
    const existing = this.findById(id, userId);
    if (!existing) return null;

    const assignments: string[] = [];
    const values: Array<string | number | null> = [];

    for (const column of Object.keys(UPDATABLE_COLUMNS) as UpdatableColumn[]) {
      if (!(column in input)) continue;
      const raw = (input as Record<string, unknown>)[column];
      if (raw === undefined) continue;
      assignments.push(`${column} = ?`);
      values.push(UPDATABLE_COLUMNS[column](raw));
    }

    const reminderWindowChanged =
      ('due_date' in input && input.due_date !== undefined) ||
      ('reminder_minutes' in input && input.reminder_minutes !== undefined);

    if (reminderWindowChanged && input.last_notification_sent === undefined) {
      assignments.push('last_notification_sent = ?');
      values.push(null);
    }

    const db = getDb();
    const applyUpdate = db.transaction(() => {
      if (assignments.length > 0) {
        assignments.push('updated_at = ?');
        values.push(toSingaporeTimestamp());
        db.prepare(
          `UPDATE todos SET ${assignments.join(', ')} WHERE id = ? AND user_id = ?`,
        ).run(...values, id, userId);
      }

      if (input.tag_ids !== undefined) {
        tagDB.setTodoTags(id, input.tag_ids, userId);
      }
    });

    applyUpdate();
    return this.findByIdWithRelations(id, userId);
  },

  /** FK CASCADE removes the todo's `subtasks` and `todo_tags` rows. */
  delete(id: number, userId: number): boolean {
    const result = getDb()
      .prepare(`DELETE FROM todos WHERE id = ? AND user_id = ?`)
      .run(id, userId);
    return result.changes > 0;
  },

  /**
   * Incomplete todos whose reminder window has opened and that have not been notified yet
   * (PRP 04). All comparisons happen in Singapore time, server-side.
   *
   * @param graceMinutes Cap on how stale a reminder may be. Windows that opened longer ago
   *   than this are skipped so reopening a long-closed tab does not flood the user. The
   *   documented default is 24 hours.
   */
  findDueReminders(userId: number, graceMinutes = 1440): Todo[] {
    const nowSql = formatSingaporeDate(getSingaporeNow(), 'yyyy-MM-dd HH:mm:ss');

    const rows = getDb()
      .prepare(
        `SELECT * FROM todos
          WHERE user_id = ?
            AND completed = 0
            AND due_date IS NOT NULL
            AND reminder_minutes IS NOT NULL
            AND last_notification_sent IS NULL
            AND datetime(due_date, '-' || reminder_minutes || ' minutes') <= datetime(?)
            AND datetime(due_date, '-' || reminder_minutes || ' minutes')
                >= datetime(?, '-' || ? || ' minutes')
          ORDER BY due_date ASC`,
      )
      .all(userId, nowSql, nowSql, graceMinutes) as TodoRow[];

    return rows.map(mapRow);
  },

  /**
   * Bulk import inside one transaction — a failure part-way through rolls back completely,
   * so a bad file never leaves a partial list behind (PRP 09).
   *
   * Tags are matched case-insensitively by name and reused; the existing tag's color wins.
   * New IDs are always assigned — original IDs from the file are never preserved.
   */
  importAll(userId: number, items: TodoExportItem[]): ImportResult {
    const db = getDb();
    let tagsCreated = 0;
    let tagsReused = 0;

    const insertTodo = db.prepare(
      `INSERT INTO todos
         (user_id, title, completed, due_date, priority, is_recurring,
          recurrence_pattern, reminder_minutes, last_notification_sent, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, NULL)`,
    );
    const insertSubtask = db.prepare(
      `INSERT INTO subtasks (todo_id, title, completed, position, created_at)
       VALUES (?, ?, ?, ?, ?)`,
    );
    const linkTodoTag = db.prepare(
      `INSERT OR IGNORE INTO todo_tags (todo_id, tag_id) VALUES (?, ?)`,
    );

    const run = db.transaction((batch: TodoExportItem[]) => {
      const now = toSingaporeTimestamp();

      for (const item of batch) {
        const todoId = Number(
          insertTodo.run(
            userId,
            item.title,
            toSqliteBoolean(item.completed),
            item.due_date ?? null,
            item.priority,
            toSqliteBoolean(item.is_recurring),
            item.recurrence_pattern ?? null,
            item.reminder_minutes ?? null,
            item.created_at || now,
          ).lastInsertRowid,
        );

        // Positions are re-normalized to array order rather than trusted verbatim, so gaps
        // or duplicates in a hand-edited file cannot scramble the checklist.
        item.subtasks.forEach((subtask, index) => {
          insertSubtask.run(
            todoId,
            subtask.title,
            toSqliteBoolean(subtask.completed),
            index,
            now,
          );
        });

        for (const tag of item.tags) {
          const existing = tagDB.findByNameCaseInsensitive(userId, tag.name);
          if (existing) {
            tagsReused += 1;
            linkTodoTag.run(todoId, existing.id);
          } else {
            const created = tagDB.create(userId, { name: tag.name, color: tag.color });
            tagsCreated += 1;
            linkTodoTag.run(todoId, created.id);
          }
        }
      }
    });

    run(items);
    return { imported: items.length, tagsCreated, tagsReused };
  },
};
