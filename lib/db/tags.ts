import { getDb } from './client';
import { toSingaporeTimestamp } from '../timezone';
import { DEFAULT_TAG_COLOR, type CreateTagInput, type Tag, type UpdateTagInput } from './types';

/**
 * CRUD for `tags` and the `todo_tags` join table (PRP 06).
 *
 * Every read and write is scoped by `user_id`; `UNIQUE(user_id, name)` is the database-level
 * backstop for per-user name uniqueness.
 */
export const tagDB = {
  findAllByUser(userId: number): Tag[] {
    return getDb()
      .prepare(`SELECT * FROM tags WHERE user_id = ? ORDER BY name COLLATE NOCASE ASC`)
      .all(userId) as Tag[];
  },

  findById(id: number, userId: number): Tag | null {
    const row = getDb()
      .prepare(`SELECT * FROM tags WHERE id = ? AND user_id = ?`)
      .get(id, userId) as Tag | undefined;
    return row ?? null;
  },

  findByNameCaseInsensitive(userId: number, name: string): Tag | null {
    const row = getDb()
      .prepare(`SELECT * FROM tags WHERE user_id = ? AND name = ? COLLATE NOCASE`)
      .get(userId, name) as Tag | undefined;
    return row ?? null;
  },

  create(userId: number, input: CreateTagInput): Tag {
    const result = getDb()
      .prepare(`INSERT INTO tags (user_id, name, color, created_at) VALUES (?, ?, ?, ?)`)
      .run(userId, input.name, input.color ?? DEFAULT_TAG_COLOR, toSingaporeTimestamp());

    const created = this.findById(Number(result.lastInsertRowid), userId);
    if (!created) {
      throw new Error('Failed to create tag');
    }
    return created;
  },

  update(id: number, userId: number, input: UpdateTagInput): Tag | null {
    const existing = this.findById(id, userId);
    if (!existing) return null;

    const assignments: string[] = [];
    const values: string[] = [];

    if (input.name !== undefined) {
      assignments.push('name = ?');
      values.push(input.name);
    }
    if (input.color !== undefined) {
      assignments.push('color = ?');
      values.push(input.color);
    }

    if (assignments.length === 0) return existing;

    getDb()
      .prepare(`UPDATE tags SET ${assignments.join(', ')} WHERE id = ? AND user_id = ?`)
      .run(...values, id, userId);

    return this.findById(id, userId);
  },

  /** Deleting a tag CASCADEs its `todo_tags` rows. Returns false when not found/not owned. */
  delete(id: number, userId: number): boolean {
    const result = getDb()
      .prepare(`DELETE FROM tags WHERE id = ? AND user_id = ?`)
      .run(id, userId);
    return result.changes > 0;
  },

  findByTodoId(todoId: number): Tag[] {
    return getDb()
      .prepare(
        `SELECT tags.* FROM tags
           JOIN todo_tags ON todo_tags.tag_id = tags.id
          WHERE todo_tags.todo_id = ?
          ORDER BY tags.name COLLATE NOCASE ASC`,
      )
      .all(todoId) as Tag[];
  },

  /** Batch read for the list endpoint — avoids one query per todo. */
  findByTodoIds(todoIds: number[]): Map<number, Tag[]> {
    const grouped = new Map<number, Tag[]>();
    if (todoIds.length === 0) return grouped;

    const placeholders = todoIds.map(() => '?').join(', ');
    const rows = getDb()
      .prepare(
        `SELECT todo_tags.todo_id AS todo_id, tags.*
           FROM tags
           JOIN todo_tags ON todo_tags.tag_id = tags.id
          WHERE todo_tags.todo_id IN (${placeholders})
          ORDER BY tags.name COLLATE NOCASE ASC`,
      )
      .all(...todoIds) as Array<Tag & { todo_id: number }>;

    for (const { todo_id: todoId, ...tag } of rows) {
      const bucket = grouped.get(todoId);
      if (bucket) bucket.push(tag);
      else grouped.set(todoId, [tag]);
    }
    return grouped;
  },

  getTagIdsForTodo(todoId: number): number[] {
    const rows = getDb()
      .prepare(`SELECT tag_id FROM todo_tags WHERE todo_id = ?`)
      .all(todoId) as Array<{ tag_id: number }>;
    return rows.map((row) => row.tag_id);
  },

  /** Idempotent: attaching an already-attached tag is a no-op, never an error. */
  attachToTodo(todoId: number, tagId: number, userId: number): boolean {
    if (!this.findById(tagId, userId)) return false;
    getDb()
      .prepare(`INSERT OR IGNORE INTO todo_tags (todo_id, tag_id) VALUES (?, ?)`)
      .run(todoId, tagId);
    return true;
  },

  /** Idempotent: detaching a tag that is not attached is a no-op, never an error. */
  detachFromTodo(todoId: number, tagId: number): void {
    getDb().prepare(`DELETE FROM todo_tags WHERE todo_id = ? AND tag_id = ?`).run(todoId, tagId);
  },

  /** Replaces a todo's full tag set, silently dropping ids the user does not own. */
  setTodoTags(todoId: number, tagIds: number[], userId: number): void {
    const db = getDb();
    const owned = new Set(this.findAllByUser(userId).map((tag) => tag.id));

    const replace = db.transaction((ids: number[]) => {
      db.prepare(`DELETE FROM todo_tags WHERE todo_id = ?`).run(todoId);
      const insert = db.prepare(`INSERT OR IGNORE INTO todo_tags (todo_id, tag_id) VALUES (?, ?)`);
      for (const tagId of ids) {
        if (owned.has(tagId)) insert.run(todoId, tagId);
      }
    });

    replace(tagIds);
  },
};
