/**
 * Shared domain types. Imported by both API routes and client components via `@/lib/db`
 * (see CLAUDE.md "Type Safety & Code Generation").
 */

// ---------------------------------------------------------------------------
// Priority (PRP 02)
// ---------------------------------------------------------------------------

export type Priority = 'high' | 'medium' | 'low';

export const PRIORITY_VALUES: readonly Priority[] = ['high', 'medium', 'low'] as const;

export const PRIORITY_ORDER: Record<Priority, number> = {
  high: 0,
  medium: 1,
  low: 2,
};

export const PRIORITY_LABELS: Record<Priority, string> = {
  high: 'High',
  medium: 'Medium',
  low: 'Low',
};

// ---------------------------------------------------------------------------
// Recurrence (PRP 03)
// ---------------------------------------------------------------------------

export type RecurrencePattern = 'daily' | 'weekly' | 'monthly' | 'yearly';

export const RECURRENCE_VALUES: readonly RecurrencePattern[] = [
  'daily',
  'weekly',
  'monthly',
  'yearly',
] as const;

// ---------------------------------------------------------------------------
// Reminders (PRP 04)
// ---------------------------------------------------------------------------

export type ReminderMinutes = 15 | 30 | 60 | 120 | 1440 | 2880 | 10080;

export const REMINDER_VALUES: readonly ReminderMinutes[] = [
  15, 30, 60, 120, 1440, 2880, 10080,
] as const;

export const REMINDER_LABELS: Record<ReminderMinutes, string> = {
  15: '15m',
  30: '30m',
  60: '1h',
  120: '2h',
  1440: '1d',
  2880: '2d',
  10080: '1w',
};

export const REMINDER_OPTION_LABELS: Record<ReminderMinutes, string> = {
  15: '15 minutes before',
  30: '30 minutes before',
  60: '1 hour before',
  120: '2 hours before',
  1440: '1 day before',
  2880: '2 days before',
  10080: '1 week before',
};

// ---------------------------------------------------------------------------
// Auth (PRP 11)
// ---------------------------------------------------------------------------

export interface User {
  id: number;
  username: string;
  created_at: string;
}

export interface Authenticator {
  id: number;
  user_id: number;
  credential_id: string;
  credential_public_key: Buffer;
  counter: number;
  transports: string | null;
  created_at: string;
}

export interface Session {
  userId: number;
  username: string;
}

// ---------------------------------------------------------------------------
// Subtasks (PRP 05)
// ---------------------------------------------------------------------------

export interface Subtask {
  id: number;
  todo_id: number;
  title: string;
  completed: boolean;
  position: number;
  created_at: string;
}

export interface CreateSubtaskDto {
  title: string;
  /** Explicit position; defaults to `MAX(position) + 1` for the parent todo. */
  position?: number;
  completed?: boolean;
}

export interface UpdateSubtaskDto {
  title?: string;
  completed?: boolean;
}

// ---------------------------------------------------------------------------
// Tags (PRP 06)
// ---------------------------------------------------------------------------

export interface Tag {
  id: number;
  user_id: number;
  name: string;
  /** Hex string, e.g. `#3B82F6`. */
  color: string;
  created_at: string;
}

export interface CreateTagInput {
  name: string;
  color?: string;
}

export interface UpdateTagInput {
  name?: string;
  color?: string;
}

export const DEFAULT_TAG_COLOR = '#3B82F6';

// ---------------------------------------------------------------------------
// Todos (PRP 01)
// ---------------------------------------------------------------------------

export interface Todo {
  id: number;
  user_id: number;
  title: string;
  completed: boolean;
  /** Singapore wall-clock `YYYY-MM-DDTHH:mm:ss`, or null. */
  due_date: string | null;
  priority: Priority;
  is_recurring: boolean;
  recurrence_pattern: RecurrencePattern | null;
  reminder_minutes: number | null;
  last_notification_sent: string | null;
  created_at: string;
  updated_at: string | null;
  subtasks?: Subtask[];
  tags?: Tag[];
}

export interface CreateTodoInput {
  title: string;
  due_date?: string | null;
  priority?: Priority;
  is_recurring?: boolean;
  recurrence_pattern?: RecurrencePattern | null;
  reminder_minutes?: number | null;
  tag_ids?: number[];
  /** Import/seed paths only; normal creation always starts incomplete. */
  completed?: boolean;
  created_at?: string;
}

export interface UpdateTodoInput extends Partial<CreateTodoInput> {
  completed?: boolean;
  last_notification_sent?: string | null;
}

// ---------------------------------------------------------------------------
// Templates (PRP 07)
// ---------------------------------------------------------------------------

export interface Template {
  id: number;
  user_id: number;
  name: string;
  description: string | null;
  category: string | null;
  title_template: string;
  priority: Priority;
  is_recurring: boolean;
  recurrence_pattern: RecurrencePattern | null;
  reminder_minutes: number | null;
  due_date_offset_minutes: number | null;
  subtasks_json: string | null;
  created_at: string;
}

export interface TemplateSubtask {
  title: string;
  position: number;
}

export interface CreateTemplateDto {
  name: string;
  description?: string | null;
  category?: string | null;
  title_template: string;
  priority?: Priority;
  is_recurring?: boolean;
  recurrence_pattern?: RecurrencePattern | null;
  reminder_minutes?: number | null;
  due_date_offset_minutes?: number | null;
  /** Serialized into `subtasks_json` before insert. */
  subtasks?: TemplateSubtask[];
}

export type UpdateTemplateDto = Partial<CreateTemplateDto>;

export const TEMPLATE_CATEGORY_SUGGESTIONS: readonly string[] = [
  'Work',
  'Personal',
  'Finance',
  'Health',
  'Education',
] as const;

// ---------------------------------------------------------------------------
// Holidays (PRP 10)
// ---------------------------------------------------------------------------

export interface Holiday {
  id: number;
  /** `YYYY-MM-DD`, Asia/Singapore. */
  date: string;
  name: string;
  created_at?: string;
}

// ---------------------------------------------------------------------------
// Export / Import (PRP 09)
// ---------------------------------------------------------------------------

export interface TodoExportItem {
  title: string;
  completed: boolean;
  due_date: string | null;
  priority: Priority;
  is_recurring: boolean;
  recurrence_pattern: RecurrencePattern | null;
  reminder_minutes: number | null;
  created_at: string;
  subtasks: Array<{ title: string; completed: boolean; position: number }>;
  tags: Array<{ name: string; color: string }>;
}

export interface TodoExport {
  version: 1;
  /** ISO 8601, Singapore local time. */
  exported_at: string;
  todos: TodoExportItem[];
}

export interface ImportResult {
  imported: number;
  tagsCreated: number;
  tagsReused: number;
}
