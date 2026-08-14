import { describe, expect, it } from 'vitest';
import {
  TOTAL_GRID_CELLS,
  formatMonthParam,
  generateCalendarGrid,
  groupTodosByDueDate,
  parseMonthParam,
  shiftMonth,
} from '@/lib/calendar';
import { makeTodo } from './factories';

const TODAY = '2026-03-15';

describe('generateCalendarGrid', () => {
  it('always emits exactly 42 cells', () => {
    // Feb 2026 starts on a Sunday and needs 4 rows; July 2026 needs 5. Both must be padded.
    expect(generateCalendarGrid(2026, 2, TODAY)).toHaveLength(TOTAL_GRID_CELLS);
    expect(generateCalendarGrid(2026, 7, TODAY)).toHaveLength(TOTAL_GRID_CELLS);
    expect(generateCalendarGrid(2026, 8, TODAY)).toHaveLength(TOTAL_GRID_CELLS);
  });

  it('marks the right number of current-month days for a 28-day February', () => {
    const grid = generateCalendarGrid(2026, 2, TODAY);
    expect(grid.filter((day) => day.isCurrentMonth)).toHaveLength(28);
  });

  it('includes Feb 29 in a leap year', () => {
    const grid = generateCalendarGrid(2028, 2, TODAY);
    const currentMonth = grid.filter((day) => day.isCurrentMonth);
    expect(currentMonth).toHaveLength(29);
    expect(currentMonth.at(-1)?.date).toBe('2028-02-29');
  });

  it('marks exactly one cell as today when the grid contains it', () => {
    const grid = generateCalendarGrid(2026, 3, TODAY);
    expect(grid.filter((day) => day.isToday)).toHaveLength(1);
  });

  it('marks no cell as today for an unrelated month', () => {
    const grid = generateCalendarGrid(2027, 9, TODAY);
    expect(grid.filter((day) => day.isToday)).toHaveLength(0);
  });

  it('marks only Sunday and Saturday columns as weekend', () => {
    const grid = generateCalendarGrid(2026, 3, TODAY);
    grid.forEach((day, index) => {
      const column = index % 7;
      expect(day.isWeekend).toBe(column === 0 || column === 6);
    });
  });

  it('derives isPast from Singapore today, not UTC today', () => {
    // At 2026-03-01T00:30 SGT the UTC date is still 28 Feb. Passing the Singapore date makes
    // 1 March "today" (not past) and 28 Feb past — the UTC reading would invert both.
    const marchGrid = generateCalendarGrid(2026, 3, '2026-03-01');
    expect(marchGrid.find((day) => day.date === '2026-03-01')?.isPast).toBe(false);

    // March 2026 begins on a Sunday, so February only appears in February's own grid.
    const februaryGrid = generateCalendarGrid(2026, 2, '2026-03-01');
    expect(februaryGrid.find((day) => day.date === '2026-02-28')?.isPast).toBe(true);
    expect(februaryGrid.find((day) => day.date === '2026-03-01')?.isPast).toBe(false);
  });
});

describe('parseMonthParam', () => {
  it('parses a well-formed value', () => {
    expect(parseMonthParam('2026-03')).toEqual({ year: 2026, month: 3 });
  });

  it('falls back to the current month for malformed or out-of-range values', () => {
    const current = parseMonthParam(null);
    expect(parseMonthParam('abc')).toEqual(current);
    expect(parseMonthParam('2026-13')).toEqual(current);
    expect(parseMonthParam('2026-00')).toEqual(current);
    expect(parseMonthParam(undefined)).toEqual(current);
  });
});

describe('shiftMonth', () => {
  it('rolls forward across a year boundary', () => {
    expect(shiftMonth({ year: 2025, month: 12 }, 1)).toEqual({ year: 2026, month: 1 });
  });

  it('rolls backward across a year boundary', () => {
    expect(shiftMonth({ year: 2026, month: 1 }, -1)).toEqual({ year: 2025, month: 12 });
  });

  it('handles multi-year jumps in both directions', () => {
    expect(shiftMonth({ year: 2026, month: 6 }, 25)).toEqual({ year: 2028, month: 7 });
    expect(shiftMonth({ year: 2026, month: 6 }, -25)).toEqual({ year: 2024, month: 5 });
  });
});

describe('formatMonthParam', () => {
  it('zero-pads the month', () => {
    expect(formatMonthParam({ year: 2026, month: 3 })).toBe('2026-03');
  });
});

describe('groupTodosByDueDate', () => {
  it('keys todos by their Singapore due date', () => {
    // 00:30 Singapore time belongs to 1 March, not 28 February.
    const justAfterMidnight = makeTodo({ due_date: '2026-03-01T00:30:00' });
    const grouped = groupTodosByDueDate([justAfterMidnight]);

    expect(grouped.get('2026-03-01')).toEqual([justAfterMidnight]);
    expect(grouped.has('2026-02-28')).toBe(false);
  });

  it('omits todos with no due date', () => {
    expect(groupTodosByDueDate([makeTodo({ due_date: null })]).size).toBe(0);
  });
});
