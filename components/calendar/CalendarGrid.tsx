'use client';

import { useMemo } from 'react';
import { CalendarCell } from './CalendarCell';
import {
  WEEKDAY_LABELS,
  generateCalendarGrid,
  groupHolidaysByDate,
  groupTodosByDueDate,
  type YearMonth,
} from '@/lib/calendar';
import { formatMonthLabel, getSingaporeNow, toSingaporeDateString } from '@/lib/timezone';
import type { Holiday, Todo } from '@/lib/db/types';

interface CalendarGridProps {
  yearMonth: YearMonth;
  todos: Todo[];
  holidays: Holiday[];
  onSelectDay: (date: string) => void;
  onNavigate: (target: YearMonth) => void;
  onToday: () => void;
}

/** Month grid with navigation controls (PRP 10). Always renders exactly 6 rows. */
export function CalendarGrid({
  yearMonth,
  todos,
  holidays,
  onSelectDay,
  onNavigate,
  onToday,
}: CalendarGridProps) {
  const { year, month } = yearMonth;

  const days = useMemo(
    () => generateCalendarGrid(year, month, toSingaporeDateString(getSingaporeNow())),
    [year, month],
  );
  const todosByDate = useMemo(() => groupTodosByDueDate(todos), [todos]);
  const holidaysByDate = useMemo(() => groupHolidaysByDate(holidays), [holidays]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2
          data-testid="calendar-month-label"
          className="text-lg font-semibold text-gray-900 dark:text-white"
        >
          {formatMonthLabel(year, month)}
        </h2>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => onNavigate({ year, month: month - 1 })}
            aria-label="Previous month"
            data-testid="calendar-prev"
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-100 dark:border-gray-600 dark:hover:bg-gray-700"
          >
            ◀
          </button>
          <button
            type="button"
            onClick={onToday}
            data-testid="calendar-today"
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-100 dark:border-gray-600 dark:hover:bg-gray-700"
          >
            Today
          </button>
          <button
            type="button"
            onClick={() => onNavigate({ year, month: month + 1 })}
            aria-label="Next month"
            data-testid="calendar-next"
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-100 dark:border-gray-600 dark:hover:bg-gray-700"
          >
            ▶
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-lg border border-gray-200 bg-gray-200 dark:border-gray-700 dark:bg-gray-700">
        {WEEKDAY_LABELS.map((label) => (
          <div
            key={label}
            className="bg-gray-100 py-2 text-center text-xs font-semibold uppercase tracking-wide text-gray-600 dark:bg-gray-900 dark:text-gray-300"
          >
            {label}
          </div>
        ))}

        {days.map((day) => (
          <CalendarCell
            key={day.date}
            day={day}
            todos={todosByDate.get(day.date) ?? []}
            holiday={holidaysByDate.get(day.date)}
            onClick={onSelectDay}
          />
        ))}
      </div>
    </div>
  );
}
