import type { RecurrencePattern } from '@/lib/db/types';

/** Recurrence marker shown inline with the priority badge (PRP 03). */
export function RecurrenceBadge({ pattern }: { pattern: RecurrencePattern }) {
  return (
    <span
      data-testid="recurrence-badge"
      data-pattern={pattern}
      className="inline-flex items-center gap-1 rounded-full border border-purple-300 bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-800 dark:border-purple-700 dark:bg-purple-900/40 dark:text-purple-200"
    >
      🔄 {pattern}
    </span>
  );
}
