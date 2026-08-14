import type { Subtask } from './db/types';

export interface SubtaskProgress {
  completed: number;
  total: number;
  /** 0-100, rounded. Always 0 when there are no subtasks. */
  percent: number;
}

/**
 * Checklist completion summary (PRP 05).
 *
 * Percent is purely a function of the rows that remain, so deleting the last incomplete
 * subtask legitimately jumps the bar to 100%.
 */
export function calculateProgress(subtasks: Subtask[] | undefined): SubtaskProgress {
  const list = subtasks ?? [];
  const total = list.length;
  const completed = list.filter((subtask) => subtask.completed).length;
  const percent = total === 0 ? 0 : Math.round((completed / total) * 100);
  return { completed, total, percent };
}
