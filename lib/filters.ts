import type { Priority, Todo } from './db/types';

/**
 * Client-side, in-memory search and filtering (PRP 08).
 *
 * Runs entirely in the browser against the `Todo[]` already loaded from `GET /api/todos` —
 * no server round-trip per keystroke, no search index. Each step is a single linear pass so
 * the whole chain stays O(n) per filter over the list.
 */

export interface FilterState {
  /** Raw (non-debounced) input value. */
  search: string;
  priority: Priority | 'all';
  tagId: number | 'all';
  completion: 'all' | 'incomplete' | 'completed';
  /** `YYYY-MM-DD`, or null. */
  dueDateFrom: string | null;
  dueDateTo: string | null;
}

export const DEFAULT_FILTER_STATE: FilterState = {
  search: '',
  priority: 'all',
  tagId: 'all',
  completion: 'all',
  dueDateFrom: null,
  dueDateTo: null,
};

export function hasActiveFilters(filters: FilterState): boolean {
  return (
    filters.search.trim() !== '' ||
    filters.priority !== 'all' ||
    filters.tagId !== 'all' ||
    filters.completion !== 'all' ||
    filters.dueDateFrom !== null ||
    filters.dueDateTo !== null
  );
}

/**
 * Apply every active filter with AND logic, in the documented order:
 * search -> priority -> tag -> completion -> date range.
 */
export function applyFilters(todos: Todo[], filters: FilterState): Todo[] {
  let result = todos;

  // 1. Search: todo title OR any subtask title, case-insensitive substring match.
  const query = filters.search.trim().toLowerCase();
  if (query) {
    result = result.filter((todo) => {
      if (todo.title.toLowerCase().includes(query)) return true;
      return (todo.subtasks ?? []).some((subtask) =>
        subtask.title.toLowerCase().includes(query),
      );
    });
  }

  // 2. Priority.
  if (filters.priority !== 'all') {
    result = result.filter((todo) => todo.priority === filters.priority);
  }

  // 3. Tag.
  if (filters.tagId !== 'all') {
    result = result.filter((todo) => (todo.tags ?? []).some((tag) => tag.id === filters.tagId));
  }

  // 4. Completion status.
  if (filters.completion === 'incomplete') {
    result = result.filter((todo) => !todo.completed);
  } else if (filters.completion === 'completed') {
    result = result.filter((todo) => todo.completed);
  }

  // 5. Due-date range. Only matches todos that actually have a due date.
  //    `due_date` is stored as Singapore wall-clock time, so the leading 10 characters are
  //    already the Singapore calendar date — no timezone conversion needed here.
  if (filters.dueDateFrom || filters.dueDateTo) {
    result = result.filter((todo) => {
      if (!todo.due_date) return false;
      const due = todo.due_date.slice(0, 10);
      if (filters.dueDateFrom && due < filters.dueDateFrom) return false;
      if (filters.dueDateTo && due > filters.dueDateTo) return false;
      return true;
    });
  }

  return result;
}

/** Human-readable summary of the active filters, shown in the save-preset preview. */
export function describeFilters(
  filters: FilterState,
  tagName: (id: number) => string | undefined,
): string[] {
  const parts: string[] = [];

  if (filters.search.trim()) parts.push(`Search: "${filters.search.trim()}"`);
  if (filters.priority !== 'all') {
    parts.push(`Priority: ${filters.priority[0].toUpperCase()}${filters.priority.slice(1)}`);
  }
  if (filters.tagId !== 'all') {
    parts.push(`Tag: ${tagName(filters.tagId) ?? 'Unknown'}`);
  }
  if (filters.completion !== 'all') {
    parts.push(
      `Completion: ${filters.completion === 'incomplete' ? 'Incomplete' : 'Completed'}`,
    );
  }
  if (filters.dueDateFrom || filters.dueDateTo) {
    parts.push(`Date: ${filters.dueDateFrom ?? 'any'} to ${filters.dueDateTo ?? 'any'}`);
  }

  return parts;
}
