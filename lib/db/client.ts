import path from 'node:path';
import Database from 'better-sqlite3';
import { MIGRATIONS, SCHEMA_SQL } from './schema';

/**
 * The single `better-sqlite3` connection for the process.
 *
 * All operations are **synchronous** — no promises anywhere in the DB layer
 * (see CLAUDE.md "Database Architecture").
 */

export type DatabaseHandle = Database.Database;

const DEFAULT_DB_FILE = 'todos.db';

/**
 * Cached on `globalThis` so Next.js dev-mode hot reloads reuse one connection instead of
 * leaking a new file handle per module re-evaluation.
 */
const globalForDb = globalThis as typeof globalThis & {
  __todoAppDb?: DatabaseHandle;
};

function resolveDatabasePath(): string {
  const configured = process.env.DATABASE_PATH?.trim();
  if (!configured) return path.join(process.cwd(), DEFAULT_DB_FILE);
  // turbopackIgnore: the path is a deployment setting, not a bundled asset. Without this the
  // bundler traces the whole project into the server output.
  return path.isAbsolute(configured)
    ? configured
    : path.join(/* turbopackIgnore: true */ process.cwd(), configured);
}

function applyMigrations(handle: DatabaseHandle): void {
  for (const statement of MIGRATIONS) {
    try {
      handle.exec(statement);
    } catch (error) {
      // Expected when the column already exists. Anything else is worth surfacing.
      const message = error instanceof Error ? error.message : String(error);
      if (!/duplicate column name|no such table/i.test(message)) {
        console.warn(`Migration skipped ("${statement}"): ${message}`);
      }
    }
  }
}

function createConnection(): DatabaseHandle {
  const handle = new Database(resolveDatabasePath());

  // ON DELETE CASCADE is inert in SQLite unless foreign keys are enabled per connection.
  // Todo -> subtasks/todo_tags and tag -> todo_tags cascades all depend on this.
  handle.pragma('foreign_keys = ON');
  handle.pragma('journal_mode = WAL');
  handle.pragma('busy_timeout = 5000');

  handle.exec(SCHEMA_SQL);
  applyMigrations(handle);

  return handle;
}

export function getDb(): DatabaseHandle {
  if (!globalForDb.__todoAppDb) {
    globalForDb.__todoAppDb = createConnection();
  }
  return globalForDb.__todoAppDb;
}

/** Close and forget the connection. Used by scripts and test teardown. */
export function closeDb(): void {
  globalForDb.__todoAppDb?.close();
  globalForDb.__todoAppDb = undefined;
}

/** SQLite stores booleans as 0/1 — convert on read. */
export const toBoolean = (value: unknown): boolean => value === 1 || value === true;

/** SQLite has no boolean type — convert on write. */
export const toSqliteBoolean = (value: boolean | undefined, fallback = false): 0 | 1 =>
  (value ?? fallback) ? 1 : 0;
