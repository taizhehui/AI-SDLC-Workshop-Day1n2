import { getSingaporeNow, toSingaporeDateString } from './timezone';
import type { Holiday, Todo } from './db/types';

/**
 * Month-grid generation for the calendar view (PRP 10).
 *
 * Pure functions with no DOM or database dependency — the grid is fully unit-testable.
 */

export interface CalendarDay {
  /** `YYYY-MM-DD`, Singapore-local. */
  date: string;
  isCurrentMonth: boolean;
  isToday: boolean;
  isPast: boolean;
  isWeekend: boolean;
}

export const DAYS_IN_WEEK = 7;
export const WEEKS_IN_GRID = 6;

/** Always 42 cells, so grid height never shifts when navigating between months. */
export const TOTAL_GRID_CELLS = DAYS_IN_WEEK * WEEKS_IN_GRID;

export const MAX_VISIBLE_TODOS = 3;

export const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

/**
 * Build the 6x7 month grid.
 *
 * @param year  Four-digit year.
 * @param month 1-indexed calendar month (1 = January).
 * @param today Singapore "today" as `YYYY-MM-DD`; injectable for deterministic tests.
 */
export function generateCalendarGrid(
  year: number,
  month: number,
  today: string = toSingaporeDateString(getSingaporeNow()),
): CalendarDay[] {
  const firstOfMonth = new Date(Date.UTC(year, month - 1, 1));
  const leadingDays = firstOfMonth.getUTCDay(); // 0 = Sunday
  const totalDaysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();

  const cells: CalendarDay[] = [];

  for (let index = 0; index < TOTAL_GRID_CELLS; index += 1) {
    const dayOffset = index - leadingDays + 1;
    const cellDate = new Date(Date.UTC(year, month - 1, dayOffset));
    const dateStr = cellDate.toISOString().slice(0, 10);
    const weekday = cellDate.getUTCDay();

    cells.push({
      date: dateStr,
      isCurrentMonth: dayOffset >= 1 && dayOffset <= totalDaysInMonth,
      isToday: dateStr === today,
      // Lexicographic comparison is safe for zero-padded YYYY-MM-DD.
      isPast: dateStr < today,
      isWeekend: weekday === 0 || weekday === 6,
    });
  }

  return cells;
}

/**
 * Index todos by their Singapore due date.
 *
 * `due_date` is stored as Singapore wall-clock time, so its first 10 characters are already
 * the correct cell key — a todo due `2026-03-01T00:30` lands on March 1, not Feb 28.
 * Todos with no due date are never placed on the calendar.
 */
export function groupTodosByDueDate(todos: Todo[]): Map<string, Todo[]> {
  const grouped = new Map<string, Todo[]>();

  for (const todo of todos) {
    if (!todo.due_date) continue;
    const key = todo.due_date.slice(0, 10);
    const bucket = grouped.get(key);
    if (bucket) bucket.push(todo);
    else grouped.set(key, [todo]);
  }

  return grouped;
}

export function groupHolidaysByDate(holidays: Holiday[]): Map<string, Holiday> {
  return new Map(holidays.map((holiday) => [holiday.date, holiday]));
}

export interface YearMonth {
  year: number;
  month: number;
}

/** Parse `?month=YYYY-MM`, falling back to the current Singapore month on anything invalid. */
export function parseMonthParam(raw: string | null | undefined): YearMonth {
  if (raw && /^\d{4}-\d{2}$/.test(raw)) {
    const [year, month] = raw.split('-').map(Number);
    if (month >= 1 && month <= 12 && year >= 1 && year <= 9999) {
      return { year, month };
    }
  }
  return currentYearMonth();
}

export function currentYearMonth(): YearMonth {
  const today = toSingaporeDateString(getSingaporeNow());
  const [year, month] = today.split('-').map(Number);
  return { year, month };
}

export function formatMonthParam({ year, month }: YearMonth): string {
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}`;
}

/** Step the month by `delta`, rolling the year over as needed. Unbounded in both directions. */
export function shiftMonth({ year, month }: YearMonth, delta: number): YearMonth {
  const zeroBased = month - 1 + delta;
  return {
    year: year + Math.floor(zeroBased / 12),
    month: ((zeroBased % 12) + 12) % 12 + 1,
  };
}
