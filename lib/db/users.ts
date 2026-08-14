import { getDb } from './client';
import { toSingaporeTimestamp } from '../timezone';
import type { User } from './types';

/** CRUD for the `users` table (PRP 11). */
export const userDB = {
  findById(id: number): User | null {
    const row = getDb().prepare(`SELECT * FROM users WHERE id = ?`).get(id) as User | undefined;
    return row ?? null;
  },

  findByUsername(username: string): User | null {
    const row = getDb()
      .prepare(`SELECT * FROM users WHERE username = ? COLLATE NOCASE`)
      .get(username) as User | undefined;
    return row ?? null;
  },

  create(username: string): User {
    const result = getDb()
      .prepare(`INSERT INTO users (username, created_at) VALUES (?, ?)`)
      .run(username, toSingaporeTimestamp());

    const created = this.findById(Number(result.lastInsertRowid));
    if (!created) {
      throw new Error('Failed to create user');
    }
    return created;
  },

  delete(id: number): void {
    getDb().prepare(`DELETE FROM users WHERE id = ?`).run(id);
  },
};
