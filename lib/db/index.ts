/**
 * Single source of truth for the data layer (CLAUDE.md "Database Architecture").
 *
 * Import path is `@/lib/db`, resolved to this barrel. The implementation is split into one
 * module per table so no file grows past a few hundred lines, but the public surface is
 * unchanged: `todoDB`, `subtaskDB`, `tagDB`, `templateDB`, `userDB`, `authenticatorDB`,
 * `holidayDB`, plus every shared type.
 *
 * ## Client/server boundary
 *
 * This barrel reaches `better-sqlite3` (a native Node module) transitively, so it must never
 * be *evaluated* in a client component. Two safe patterns for `'use client'` files:
 *
 *   - Types:     `import type { Todo } from '@/lib/db';`      // erased at compile time
 *   - Constants: `import { PRIORITY_LABELS } from '@/lib/db/types';`  // pure, no DB import
 *
 * Server code (API routes, scripts) may import anything from here directly.
 */

export * from './types';

export { getDb, closeDb, toBoolean, toSqliteBoolean } from './client';
export type { DatabaseHandle } from './client';

export { userDB } from './users';
export { authenticatorDB } from './authenticators';
export type { CreateAuthenticatorInput } from './authenticators';
export { todoDB } from './todos';
export { subtaskDB } from './subtasks';
export { tagDB } from './tags';
export { templateDB, parseTemplateSubtasks, serializeTemplateSubtasks } from './templates';
export { holidayDB } from './holidays';
