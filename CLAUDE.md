# Todo App - Claude Code Instructions

## Current Repository State

All 11 PRPs are implemented. The application source (`app/`, `components/`, `lib/`, `middleware.ts`, `scripts/`, `tests/`) exists and builds. `PRPs/*.md` remain the specification of record; `USER_GUIDE.md` and `EVALUATION.md` describe intended behaviour and acceptance criteria.

Run `npm install`, then `npm run seed:holidays`, then `npm run dev`.

## Architecture Overview

A **Next.js 16** todo application with WebAuthn authentication, using **better-sqlite3** for data persistence and **Playwright** for E2E testing. All operations use **Singapore timezone** (`Asia/Singapore`).

### Core Stack
- **Frontend**: Next.js App Router, React 19, Tailwind CSS 4
- **Backend**: Next.js API routes (no separate server)
- **Database**: SQLite via `better-sqlite3` (`todos.db` in project root)
- **Auth**: WebAuthn/Passkeys with JWT sessions (no passwords)
- **Testing**: Playwright E2E tests

## Critical Patterns

### 1. Authentication Flow (WebAuthn/Passkeys)
- **WebAuthn only** - no traditional passwords
- Uses `@simplewebauthn/server` and `@simplewebauthn/browser` libraries
- Session tokens stored as HTTP-only cookies via `lib/auth.ts` (JWT with 7-day expiry)
- Middleware (`middleware.ts`) protects `/` and `/calendar` routes
- When modifying authenticator logic, **always use `?? 0` for counter field** to handle undefined values:
  ```typescript
  counter: authenticator.counter ?? 0
  ```

**WebAuthn Flow Pattern:**
1. Client calls `/api/auth/register-options` or `/api/auth/login-options` to get challenge
2. Client uses `@simplewebauthn/browser` to interact with authenticator
3. Client posts response to `/api/auth/register-verify` or `/api/auth/login-verify`
4. Server verifies response using `@simplewebauthn/server` and creates JWT session

**Buffer Encoding:** WebAuthn credentials require base64/base64url conversions. Use `isoBase64URL` from `@simplewebauthn/server/helpers` for credential_id handling.

### 2. Database Architecture
**Single source of truth**: `lib/db.ts` exports all database interfaces and CRUD operations (~700 lines).

**Technology:** `better-sqlite3` - synchronous SQLite library (no async/await needed for DB operations). Database file: `todos.db` in project root.

Key tables:
- `users` → `authenticators` (one-to-many)
- `users` → `todos` → `subtasks` (one-to-many with CASCADE delete)
- `todos` ↔ `tags` (many-to-many via `todo_tags`)
- `users` → `templates` (reusable todo patterns with JSON-serialized subtasks)
- `holidays` (Singapore public holidays, timezone-aware)

**When adding database features:**
- Add interface to `lib/db.ts` first
- Export DB object with CRUD methods (e.g., `todoDB`, `tagDB`)
- Use prepared statements for all queries (`db.prepare()`)
- Handle migrations with try-catch `ALTER TABLE` blocks in `db.exec()`
- **All DB operations are synchronous** - no promises/async needed for queries

### 3. Singapore Timezone (Mandatory)
All date/time operations **must** use `lib/timezone.ts`:
```typescript
import { getSingaporeNow, formatSingaporeDate } from '@/lib/timezone';
const now = getSingaporeNow(); // NOT new Date()
```
This applies to: due dates, reminders, recurring todos, holiday calculations.

### 4. API Route Patterns
All API routes follow this structure:
```typescript
export async function GET/POST/PUT/DELETE(request: NextRequest) {
  const session = await getSession(); // Always check auth first
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  // For routes with params:
  const { id } = await params; // params is a Promise in Next.js 16

  // Use session.userId for all DB queries
}
```

### 5. Feature-Rich Todo Model
Todos support: priority (high/medium/low), recurring patterns (daily/weekly/monthly/yearly), reminders (15m/30m/1h/2h/1d/2d/1w before), subtasks with progress tracking, and tags.

**When completing recurring todos**: Create next instance with same priority, tags, reminder offset, and recurrence pattern. See `app/api/todos/[id]/route.ts` PUT handler.

## Development Workflows

### Setup & Run
```bash
npm install
npm run dev           # Start dev server on :3000
npm run build         # Production build
npm run lint          # ESLint check
```

### Testing
```bash
npm test                                     # Unit tests (vitest)
npx playwright test                          # All E2E tests
npx playwright test --ui                     # Interactive UI mode
npx playwright test tests/e2e/02-todo-crud.spec.ts   # Single test file
npx playwright show-report                   # View HTML report
```

**Virtual WebAuthn Authenticators:**
- Tests use virtual authenticators, attached over CDP by `installVirtualAuthenticator()` in `tests/e2e/helpers.ts`; the enabling Chromium flags live in `playwright.config.ts`
- `timezoneId: 'Asia/Singapore'` is set in the Playwright config to match the app timezone
- Test files are organized by feature (`01-authentication`, `02-todo-crud`, …) matching `USER_GUIDE.md` order
- `tests/e2e/helpers.ts` provides `registerAndLogin()`, `createTodo()`, `addSubtask()`, `createTag()`, `dueDateInMinutes()`
- E2E runs with `workers: 1` — the app writes to one SQLite file, so parallel workers would race

### Database Management
```bash
# Seed Singapore holidays
npx tsx scripts/seed-holidays.ts

# Inspect database (SQLite CLI)
sqlite3 todos.db
```

## Project-Specific Conventions

### 1. Client vs Server Components
- Pages (`app/page.tsx`, `app/calendar/page.tsx`, `app/login/page.tsx`) are `'use client'` — they compose components and delegate state to hooks
- API routes handle all database operations server-side
- Never *evaluate* `@/lib/db` in a client component: it reaches `better-sqlite3`. Client components import types with `import type { … } from '@/lib/db'` (erased at compile time) and runtime constants from `@/lib/db/types` (pure, no DB import)

### 2. Error Handling in API Routes
Always use null coalescing for potentially undefined database fields:
```typescript
counter: authenticator.counter ?? 0
reminder_minutes: todo.reminder_minutes ?? null
```
Route handlers wrap their body in `withErrorHandling()` from `lib/api-response.ts`, which logs the exception and returns a generic 500 rather than leaking internals.

### 3. Modular UI Pattern
The UI is split by feature; no page or component is monolithic, per
`.claude/rules/coding-style.md` (200–400 lines typical, 800 max).

- `app/page.tsx` is a **composition layer only** (~200 lines): it wires hooks to components and owns nothing but which modal is open
- Each feature owns a hook in `lib/hooks/` holding its state and API calls (`useTodos`, `useTags`, `useTemplates`, `useFilters`, `useSubtasks`, `useNotifications`, `useTodoForm`, `useWebAuthn`)
- Each feature owns a component folder under `components/` (`todos/`, `subtasks/`, `tags/`, `templates/`, `filters/`, `calendar/`, `badges/`, `layout/`, `ui/`)
- Pure logic lives in dependency-free `lib/` modules so it is unit-testable without React or a database: `todo-sort.ts`, `filters.ts`, `recurrence.ts`, `calendar.ts`, `progress.ts`, `csv.ts`, `template-subtasks.ts`, `todo-rules.ts`
- When adding a feature: new hook + new component folder, not new lines in `app/page.tsx`

### 4. Type Safety & Code Generation
Shared types live in `lib/db/types.ts` and are re-exported from the `@/lib/db` barrel:
```typescript
import { Priority, RecurrencePattern, Todo, Template } from '@/lib/db';
```

## Key Integration Points

### Notification System
- Browser notifications use `lib/hooks/useNotifications.ts` hook
- Backend checks due reminders via `app/api/notifications/check/route.ts`
- Frontend polls this endpoint every 30 seconds and triggers browser notifications
- Respects `last_notification_sent` to prevent duplicates

### Template System
- Templates in `templates` table store todo patterns with JSON-serialized subtasks
- `POST /api/templates/[id]/use` creates todo from template, calculating due date from offset
- Subtasks JSON structure: `[{ title: string, position: number }]`
- When creating templates, serialize subtasks array to JSON string before storing

### Export/Import
- `GET /api/todos/export` returns JSON with todos, subtasks, and tags
- `POST /api/todos/import` accepts same format, remaps IDs, preserves relationships

## Common Pitfalls

1. **Don't use `new Date()` directly** - always use `getSingaporeNow()` from `lib/timezone.ts`
2. **params is async in Next.js 16** - use `const { id } = await params`
3. **Database fields can be null/undefined** - use `?? 0` or `|| null` when passing to functions
4. **Recurring todos need special handling** - see PUT `/api/todos/[id]` for completion logic
5. **WebAuthn credentials use base64/base64url encoding** - buffer conversions required

## File Reference

- **Auth**: `lib/auth.ts` (JWT sessions), `lib/webauthn.ts` (RP config + challenge store), `middleware.ts`, `app/api/auth/**`
- **Database**: `lib/db/` — one module per table (`todos.ts`, `subtasks.ts`, `tags.ts`, `templates.ts`, `users.ts`, `authenticators.ts`, `holidays.ts`) plus `client.ts` (connection + pragmas), `schema.ts` (DDL + migrations), `types.ts` (shared types), and `index.ts` (the `@/lib/db` barrel)
- **Timezone**: `lib/timezone.ts` — the only place `new Date()` is called
- **Pure logic**: `lib/todo-sort.ts`, `lib/filters.ts`, `lib/filter-presets.ts`, `lib/recurrence.ts`, `lib/calendar.ts`, `lib/progress.ts`, `lib/csv.ts`, `lib/template-subtasks.ts`, `lib/todo-rules.ts`, `lib/validation.ts`
- **Hooks**: `lib/hooks/*.ts`
- **UI**: `components/<feature>/*.tsx`; pages in `app/` are composition only
- **API Routes**: `app/api/**/route.ts` (RESTful structure)
- **Tests**: `tests/unit/*.test.ts` (vitest), `tests/e2e/*.spec.ts` + `tests/e2e/helpers.ts` (Playwright)

## Related Documentation

- **`PRPs/`** - Product Requirement Prompts, one per feature (schema, endpoints, UI, edge cases, acceptance criteria, tests). Read the relevant PRP before implementing or modifying a feature. Start at `PRPs/README.md`.
- **`USER_GUIDE.md`** - comprehensive user-facing feature documentation (2000+ lines)
- **`EVALUATION.md`** - feature completeness checklist, acceptance criteria, and deployment (Railway/Vercel) guidance
- **`.github/copilot-instructions.md`** - equivalent instructions written for GitHub Copilot; keep in sync with this file if either changes

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
