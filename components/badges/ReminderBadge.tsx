import { REMINDER_LABELS, type ReminderMinutes } from '@/lib/db/types';

/** Reminder marker with the abbreviated offset, e.g. `🔔 1h` (PRP 04). */
export function ReminderBadge({ minutes }: { minutes: number }) {
  const label = REMINDER_LABELS[minutes as ReminderMinutes] ?? `${minutes}m`;

  return (
    <span
      data-testid="reminder-badge"
      data-minutes={minutes}
      className="inline-flex items-center gap-1 rounded-full border border-orange-300 bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-800 dark:border-orange-700 dark:bg-orange-900/40 dark:text-orange-200"
    >
      🔔 {label}
    </span>
  );
}
