import { PRIORITY_LABELS, type Priority } from '@/lib/db/types';

/**
 * Colour-coded priority badge (PRP 02).
 *
 * Palette: red (high) / yellow (medium) / blue (low), with dark-mode variants chosen so text
 * clears WCAG AA contrast against its own background in both schemes.
 */
const PRIORITY_STYLES: Record<Priority, string> = {
  high: 'bg-red-100 text-red-800 border-red-300 dark:bg-red-900/40 dark:text-red-200 dark:border-red-700',
  medium:
    'bg-yellow-100 text-yellow-800 border-yellow-300 dark:bg-yellow-900/40 dark:text-yellow-200 dark:border-yellow-700',
  low: 'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900/40 dark:text-blue-200 dark:border-blue-700',
};

export function PriorityBadge({ priority }: { priority: Priority }) {
  return (
    <span
      data-testid={`priority-badge-${priority}`}
      data-priority={priority}
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${PRIORITY_STYLES[priority]}`}
    >
      {PRIORITY_LABELS[priority]}
    </span>
  );
}
