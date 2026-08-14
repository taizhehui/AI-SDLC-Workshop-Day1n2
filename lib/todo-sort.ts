import { getSingaporeNow, parseSingaporeDate, tryParseSingaporeDate } from './timezone';
import { PRIORITY_ORDER, type Todo } from './db/types';

/**
 * Sorting and Overdue/Pending/Completed sectioning (PRP 01 + PRP 02).
 *
 * Pure functions — they never mutate their input and never touch the DOM or the database,
 * so the same code runs on the server, in the client, and in unit tests.
 */

export interface TodoSections {
  overdue: Todo[];
  pending: Todo[];
  completed: Todo[];
}

/**
 * Ordering within Overdue and Pending:
 *   1. priority  — high, then medium, then low
 *   2. due date  — earliest first; todos with no due date sort last
 *   3. created   — newest first (tiebreaker)
 */
export function compareTodos(a: Todo, b: Todo): number {
  const priorityDiff = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
  if (priorityDiff !== 0) return priorityDiff;

  if (a.due_date && b.due_date) {
    const dueDiff = toTime(a.due_date) - toTime(b.due_date);
    if (dueDiff !== 0) return dueDiff;
  } else if (a.due_date && !b.due_date) {
    return -1;
  } else if (!a.due_date && b.due_date) {
    return 1;
  }

  return toTime(b.created_at) - toTime(a.created_at);
}

/** Completed todos are ordered by when they were completed, newest first. */
export function compareCompletedTodos(a: Todo, b: Todo): number {
  return toTime(b.updated_at ?? b.created_at) - toTime(a.updated_at ?? a.created_at);
}

/** Sorted copy — the input array is never mutated. */
export function sortTodos(todos: Todo[]): Todo[] {
  return [...todos].sort(compareTodos);
}

/**
 * Split todos into the three rendered sections.
 *
 * A todo with no due date is always Pending, never Overdue, regardless of age. Unchecking a
 * completed todo whose due date has passed returns it to Overdue, which falls out naturally
 * from evaluating `due_date` rather than tracking a separate flag.
 */
export function sectionTodos(todos: Todo[], now: Date = getSingaporeNow()): TodoSections {
  const nowTime = now.getTime();
  const incomplete = todos.filter((todo) => !todo.completed);

  const isOverdue = (todo: Todo): boolean => {
    if (!todo.due_date) return false;
    const due = tryParseSingaporeDate(todo.due_date);
    return due !== null && due.getTime() < nowTime;
  };

  return {
    overdue: sortTodos(incomplete.filter(isOverdue)),
    pending: sortTodos(incomplete.filter((todo) => !isOverdue(todo))),
    completed: [...todos.filter((todo) => todo.completed)].sort(compareCompletedTodos),
  };
}

function toTime(value: string | null): number {
  if (!value) return Number.POSITIVE_INFINITY;
  try {
    return parseSingaporeDate(value).getTime();
  } catch {
    return Number.POSITIVE_INFINITY;
  }
}
