import { isDueDateFarEnoughOut, validatePriority } from './validation';
import { getSingaporeNow, toSingaporeTimestamp, tryParseSingaporeDate } from './timezone';
import { isRecurrencePattern } from './recurrence';
import type { Priority, RecurrencePattern, Todo } from './db/types';

/**
 * Cross-field business rules shared by `POST /api/todos` and `PUT /api/todos/[id]`.
 *
 * Kept out of the route handlers so both paths enforce identical semantics and the rules
 * stay unit-testable without a request object.
 */

export interface TodoRuleViolation {
  message: string;
  status: 400;
}

/** Normalize an incoming due date to the canonical stored format, or null. */
export function normalizeDueDate(value: string | null | undefined): string | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = tryParseSingaporeDate(value);
  return parsed ? toSingaporeTimestamp(parsed) : null;
}

/**
 * Validate a create payload's cross-field constraints.
 *
 * - Due dates must be at least one minute out, measured against **server** time so client
 *   clock skew cannot bypass the rule.
 * - Recurring todos require both a due date (the anchor for the next occurrence) and a valid
 *   pattern.
 */
export function validateNewTodo(input: {
  due_date: string | null;
  is_recurring: boolean;
  recurrence_pattern: RecurrencePattern | null;
  priority: unknown;
}): TodoRuleViolation | null {
  try {
    validatePriority(input.priority);
  } catch (error) {
    return { message: (error as Error).message, status: 400 };
  }

  if (input.due_date && !isDueDateFarEnoughOut(input.due_date, getSingaporeNow())) {
    return { message: 'Due date must be at least 1 minute in the future', status: 400 };
  }

  return validateRecurrence(input.is_recurring, input.recurrence_pattern, input.due_date);
}

/**
 * Validate recurrence against the resulting (post-merge) state of a todo.
 * Applies to both create and update, since an update can turn recurrence on.
 */
export function validateRecurrence(
  isRecurring: boolean,
  pattern: RecurrencePattern | null,
  dueDate: string | null,
): TodoRuleViolation | null {
  if (!isRecurring) return null;

  if (!dueDate) {
    return { message: 'Recurring todos require a due date', status: 400 };
  }
  if (!isRecurrencePattern(pattern)) {
    return { message: 'Invalid recurrence pattern', status: 400 };
  }
  return null;
}

/**
 * Resolve what a todo's recurrence fields will be after an update is applied, so recurrence
 * rules can be checked against the merged state rather than only the patch.
 */
export function resolveUpdatedRecurrence(
  existing: Todo,
  patch: {
    is_recurring?: boolean;
    recurrence_pattern?: RecurrencePattern | null;
    due_date?: string | null;
  },
): { isRecurring: boolean; pattern: RecurrencePattern | null; dueDate: string | null } {
  return {
    isRecurring: patch.is_recurring ?? existing.is_recurring,
    pattern:
      patch.recurrence_pattern !== undefined
        ? patch.recurrence_pattern
        : existing.recurrence_pattern,
    dueDate: patch.due_date !== undefined ? patch.due_date : existing.due_date,
  };
}

/**
 * True only for a genuine `false -> true` completion transition.
 *
 * A second PUT on an already-completed todo must not spawn another recurrence instance, so
 * a rapid double-click cannot duplicate the next occurrence.
 */
export function isCompletionTransition(existing: Todo, patchCompleted: boolean | undefined): boolean {
  return patchCompleted === true && existing.completed === false;
}

/** True when completing this todo should spawn the next occurrence. */
export function shouldSpawnNextInstance(existing: Todo): boolean {
  return Boolean(existing.is_recurring && existing.recurrence_pattern && existing.due_date);
}

export const DEFAULT_PRIORITY: Priority = 'medium';
