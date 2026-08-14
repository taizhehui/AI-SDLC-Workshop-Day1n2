import {
  addSingaporeDays,
  daysInMonth,
  fromSingaporeParts,
  toSingaporeParts,
} from './timezone';
import type { RecurrencePattern } from './db/types';

/**
 * Next-occurrence date math for recurring todos (PRP 03).
 *
 * Pure and side-effect free. All arithmetic runs on the Singapore-local representation of
 * the due date and preserves time-of-day exactly.
 *
 * Day-of-month is **clamped**, never rolled over: JS's native `setMonth`/`setDate` turn
 * Jan 31 + 1 month into Mar 3, which is not what a monthly bill reminder means.
 */
export function calculateNextDueDate(
  currentDueDate: string,
  pattern: RecurrencePattern,
): string {
  const { year, month, day, hour, minute, second } = toSingaporeParts(currentDueDate);

  switch (pattern) {
    case 'daily':
      return fromSingaporeParts(addSingaporeDays({ year, month, day }, 1), hour, minute, second);

    case 'weekly':
      return fromSingaporeParts(addSingaporeDays({ year, month, day }, 7), hour, minute, second);

    case 'monthly': {
      const targetMonth = month === 12 ? 1 : month + 1;
      const targetYear = month === 12 ? year + 1 : year;
      // Jan 31 -> Feb 28 (or Feb 29 in a leap year), never Mar 3.
      const clampedDay = Math.min(day, daysInMonth(targetYear, targetMonth));
      return fromSingaporeParts(
        { year: targetYear, month: targetMonth, day: clampedDay },
        hour,
        minute,
        second,
      );
    }

    case 'yearly': {
      const targetYear = year + 1;
      // Feb 29 -> Feb 28 when the target year is not a leap year.
      const clampedDay = Math.min(day, daysInMonth(targetYear, month));
      return fromSingaporeParts({ year: targetYear, month, day: clampedDay }, hour, minute, second);
    }
  }
}

/** True when the value is one of the four supported cadences. */
export function isRecurrencePattern(value: unknown): value is RecurrencePattern {
  return value === 'daily' || value === 'weekly' || value === 'monthly' || value === 'yearly';
}

export const RECURRENCE_LABELS: Record<RecurrencePattern, string> = {
  daily: 'Daily',
  weekly: 'Weekly',
  monthly: 'Monthly',
  yearly: 'Yearly',
};
