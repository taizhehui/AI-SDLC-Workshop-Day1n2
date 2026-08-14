import { z } from 'zod';
import { getSingaporeNow, isValidSingaporeDate, parseSingaporeDate } from './timezone';
import {
  PRIORITY_VALUES,
  RECURRENCE_VALUES,
  REMINDER_VALUES,
  type Priority,
  type RecurrencePattern,
} from './db/types';

/**
 * Request-body validation shared by every API route (`.claude/rules/coding-style.md`
 * "Input Validation"). Schemas live here so the route handlers stay thin.
 */

export const HEX_COLOR = /^#[0-9A-Fa-f]{6}$/;

/** Minimum lead time for a due date, enforced server-side against server "now". */
export const MIN_DUE_DATE_LEAD_MS = 60_000;

export const prioritySchema = z.enum(PRIORITY_VALUES as [Priority, ...Priority[]]);
export const recurrenceSchema = z.enum(
  RECURRENCE_VALUES as [RecurrencePattern, ...RecurrencePattern[]],
);
export const reminderSchema = z.union(
  REMINDER_VALUES.map((value) => z.literal(value)) as unknown as [
    z.ZodLiteral<number>,
    z.ZodLiteral<number>,
    ...z.ZodLiteral<number>[],
  ],
);

/** A stored timestamp: `YYYY-MM-DD`, optionally with a time and/or timezone suffix. */
export const timestampSchema = z
  .string()
  .refine((value) => isValidSingaporeDate(value), { message: 'Invalid date format' });

/**
 * Coerce an incoming `priority` to a valid value.
 *
 * `undefined`/`null` means "not specified" and defaults to medium; anything else that is not
 * an exact lowercase enum member is an error.
 *
 * @throws {Error} with a user-facing message on an invalid value.
 */
export function validatePriority(value: unknown): Priority {
  if (value === undefined || value === null) return 'medium';
  if (value === 'high' || value === 'medium' || value === 'low') return value;
  throw new Error(
    `Invalid priority: ${String(value)}. Must be 'high', 'medium', or 'low'.`,
  );
}

/** True when the due date is at least one minute in the future, measured against server time. */
export function isDueDateFarEnoughOut(dueDate: string, now: Date = getSingaporeNow()): boolean {
  return parseSingaporeDate(dueDate).getTime() >= now.getTime() + MIN_DUE_DATE_LEAD_MS;
}

// ---------------------------------------------------------------------------
// Todos (PRP 01-04)
// ---------------------------------------------------------------------------

export const createTodoSchema = z.object({
  title: z.string().trim().min(1, 'Title is required'),
  due_date: timestampSchema.nullish(),
  priority: prioritySchema.optional(),
  is_recurring: z.boolean().optional(),
  recurrence_pattern: recurrenceSchema.nullish(),
  reminder_minutes: reminderSchema.nullish(),
  tag_ids: z.array(z.number().int().positive()).optional(),
});

export const updateTodoSchema = z.object({
  title: z.string().trim().min(1, 'Title cannot be empty').optional(),
  completed: z.boolean().optional(),
  due_date: timestampSchema.nullish(),
  priority: prioritySchema.optional(),
  is_recurring: z.boolean().optional(),
  recurrence_pattern: recurrenceSchema.nullish(),
  reminder_minutes: reminderSchema.nullish(),
  last_notification_sent: timestampSchema.nullish(),
  tag_ids: z.array(z.number().int().positive()).optional(),
});

// ---------------------------------------------------------------------------
// Subtasks (PRP 05)
// ---------------------------------------------------------------------------

export const createSubtaskSchema = z.object({
  title: z.string().trim().min(1, 'Subtask title is required'),
});

export const updateSubtaskSchema = z.object({
  title: z.string().trim().min(1, 'Subtask title cannot be empty').optional(),
  completed: z.boolean().optional(),
});

// ---------------------------------------------------------------------------
// Tags (PRP 06)
// ---------------------------------------------------------------------------

export const createTagSchema = z.object({
  name: z.string().trim().min(1, 'Tag name is required'),
  color: z.string().regex(HEX_COLOR, 'Color must be a valid hex code').optional(),
});

export const updateTagSchema = z.object({
  name: z.string().trim().min(1, 'Tag name cannot be empty').optional(),
  color: z.string().regex(HEX_COLOR, 'Color must be a valid hex code').optional(),
});

export const todoTagSchema = z.object({
  tag_id: z.number().int().positive(),
});

// ---------------------------------------------------------------------------
// Templates (PRP 07)
// ---------------------------------------------------------------------------

const templateSubtaskSchema = z.object({
  title: z.string().trim().min(1),
  position: z.number().int().nonnegative().optional(),
});

export const createTemplateSchema = z.object({
  name: z.string().trim().min(1, 'Name and title are required'),
  description: z.string().trim().nullish(),
  category: z.string().trim().nullish(),
  title_template: z.string().trim().min(1, 'Name and title are required'),
  priority: prioritySchema.optional(),
  is_recurring: z.boolean().optional(),
  recurrence_pattern: recurrenceSchema.nullish(),
  reminder_minutes: reminderSchema.nullish(),
  due_date_offset_minutes: z.number().int().nullish(),
  subtasks: z.array(templateSubtaskSchema).optional(),
});

export const updateTemplateSchema = createTemplateSchema.partial();

// ---------------------------------------------------------------------------
// Import (PRP 09)
// ---------------------------------------------------------------------------

export const importSchema = z.object({
  version: z.literal(1),
  exported_at: z.string(),
  todos: z.array(
    z.object({
      title: z.string().min(1),
      completed: z.boolean(),
      due_date: z.string().nullable(),
      priority: prioritySchema,
      is_recurring: z.boolean(),
      recurrence_pattern: recurrenceSchema.nullable(),
      reminder_minutes: z.number().int().nullable(),
      created_at: z.string(),
      subtasks: z.array(
        z.object({
          title: z.string().min(1),
          completed: z.boolean(),
          position: z.number().int(),
        }),
      ),
      tags: z.array(z.object({ name: z.string().min(1), color: z.string() })),
    }),
  ),
});

// ---------------------------------------------------------------------------
// Auth (PRP 11)
// ---------------------------------------------------------------------------

export const usernameSchema = z
  .string()
  .trim()
  .min(3, 'Username must be at least 3 characters')
  .max(64, 'Username must be at most 64 characters')
  .regex(/^[A-Za-z0-9._-]+$/, 'Username may only contain letters, numbers, dot, dash, underscore');

export const authOptionsSchema = z.object({ username: usernameSchema });

export const authVerifySchema = z.object({
  username: usernameSchema,
  response: z.record(z.string(), z.unknown()),
});
