'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AppHeader } from '@/components/layout/AppHeader';
import { CalendarGrid } from '@/components/calendar/CalendarGrid';
import { DayTodosModal } from '@/components/calendar/DayTodosModal';
import { Banner } from '@/components/ui/Banner';
import { apiClient } from '@/lib/api-client';
import {
  currentYearMonth,
  formatMonthParam,
  parseMonthParam,
  shiftMonth,
  type YearMonth,
} from '@/lib/calendar';
import type { Holiday, Todo } from '@/lib/db/types';

/**
 * Calendar view (PRP 10).
 *
 * A read-oriented companion to the list view: no todo creation or editing here. The visible
 * month lives in the URL (`?month=YYYY-MM`) so refreshing or bookmarking reopens the same
 * month. The calendar deliberately ignores list-view filters and always shows every
 * due-dated todo.
 */
function CalendarView() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Invalid or out-of-range values fall back silently to the current Singapore month.
  const yearMonth = useMemo(
    () => parseMonthParam(searchParams.get('month')),
    [searchParams],
  );

  const [todos, setTodos] = useState<Todo[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const [todoList, holidayResponse] = await Promise.all([
          apiClient.get<Todo[]>('/api/todos'),
          apiClient.get<{ holidays: Holiday[] }>(
            `/api/holidays?year=${yearMonth.year}&month=${yearMonth.month}`,
          ),
        ]);
        if (cancelled) return;
        setTodos(todoList);
        setHolidays(holidayResponse.holidays);
        setError(null);
      } catch (err) {
        if (cancelled) return;
        console.error('Failed to load calendar data:', err);
        setError('Could not load the calendar. Please refresh the page.');
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [yearMonth.year, yearMonth.month]);

  // `replace` rather than `push`: one history entry per month click would make the browser
  // back button unusable after a few navigations.
  const navigate = useCallback(
    (target: YearMonth) => {
      const normalized = shiftMonth({ year: target.year, month: 1 }, target.month - 1);
      router.replace(`/calendar?month=${formatMonthParam(normalized)}`);
    },
    [router],
  );

  const selectedHoliday = holidays.find((holiday) => holiday.date === selectedDate);
  const selectedTodos = selectedDate
    ? todos.filter((todo) => todo.due_date?.startsWith(selectedDate))
    : [];

  return (
    <main className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6">
      <AppHeader current="calendar" />

      {error && <Banner tone="error">{error}</Banner>}

      <CalendarGrid
        yearMonth={yearMonth}
        todos={todos}
        holidays={holidays}
        onSelectDay={setSelectedDate}
        onNavigate={navigate}
        onToday={() => navigate(currentYearMonth())}
      />

      {selectedDate && (
        <DayTodosModal
          date={selectedDate}
          todos={selectedTodos}
          holiday={selectedHoliday}
          onClose={() => setSelectedDate(null)}
        />
      )}
    </main>
  );
}

export default function CalendarPage() {
  // `useSearchParams` requires a Suspense boundary during static rendering.
  return (
    <Suspense
      fallback={<p className="p-6 text-gray-500 dark:text-gray-400">Loading calendar…</p>}
    >
      <CalendarView />
    </Suspense>
  );
}
