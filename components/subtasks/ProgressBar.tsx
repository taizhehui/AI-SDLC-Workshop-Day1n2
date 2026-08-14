import type { SubtaskProgress } from '@/lib/progress';

/**
 * Checklist progress bar (PRP 05).
 *
 * Hidden entirely when a todo has no subtasks — an empty `0/0` bar would be noise on the
 * majority of todos. Turns green only at exactly 100%.
 */
export function ProgressBar({ completed, total, percent }: SubtaskProgress) {
  if (total === 0) return null;

  const barColor = percent === 100 ? 'bg-green-500' : 'bg-blue-500';

  return (
    <div className="mt-1" data-testid="subtask-progress" data-percent={percent}>
      <div className="mb-1 flex justify-between text-xs text-gray-500 dark:text-gray-400">
        <span data-testid="subtask-progress-count">
          {completed}/{total} subtasks
        </span>
        <span>{percent}%</span>
      </div>
      <div
        className="h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700"
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${completed} of ${total} subtasks complete`}
      >
        <div
          className={`h-full transition-all duration-200 ${barColor}`}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
