'use client';

import { MAX_VISIBLE_TODOS, type CalendarDay } from '@/lib/calendar';
import type { Holiday, Priority, Todo } from '@/lib/db/types';

/** Pill colours reuse PRP 02's palette so priority reads the same in both views. */
const PILL_STYLES: Record<Priority, string> = {
  high: 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-200',
  medium: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-200',
  low: 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-200',
};

interface CalendarCellProps {
  day: CalendarDay;
  todos: Todo[];
  holiday: Holiday | undefined;
  onClick: (date: string) => void;
}

function cellClasses(day: CalendarDay): string {
  const classes = [
    'flex min-h-24 w-full flex-col gap-1 border border-gray-200 p-1 text-left align-top transition-colors dark:border-gray-700',
  ];

  if (!day.isCurrentMonth) classes.push('bg-gray-50 opacity-50 dark:bg-gray-900');
  else if (day.isWeekend) classes.push('bg-blue-50/40 dark:bg-gray-800/60');
  else classes.push('bg-white dark:bg-gray-800');

  if (day.isToday) classes.push('ring-2 ring-inset ring-blue-500');
  else if (day.isPast && day.isCurrentMonth) classes.push('text-gray-400 dark:text-gray-500');

  classes.push('hover:bg-blue-50 dark:hover:bg-gray-700');
  return classes.join(' ');
}

/** One day cell: date number, holiday label, up to three todo pills, then a "+N more". */
export function CalendarCell({ day, todos, holiday, onClick }: CalendarCellProps) {
  const visible = todos.slice(0, MAX_VISIBLE_TODOS);
  const overflow = todos.length - visible.length;

  return (
    <button
      type="button"
      onClick={() => onClick(day.date)}
      data-testid={`calendar-cell-${day.date}`}
      data-current-month={day.isCurrentMonth}
      data-today={day.isToday}
      data-weekend={day.isWeekend}
      className={cellClasses(day)}
    >
      <span className={`text-xs font-semibold ${day.isToday ? 'text-blue-600 dark:text-blue-400' : ''}`}>
        {Number(day.date.slice(8, 10))}
      </span>

      {/* Holiday sits above the pills so neither hides the other. */}
      {holiday && (
        <span
          data-testid={`holiday-${day.date}`}
          className="truncate rounded bg-emerald-100 px-1 text-[10px] font-medium text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200"
        >
          {holiday.name}
        </span>
      )}

      {visible.map((todo) => (
        <span
          key={todo.id}
          title={todo.title}
          data-testid={`calendar-todo-${todo.id}`}
          className={`truncate rounded px-1 text-[10px] ${PILL_STYLES[todo.priority]} ${
            todo.completed ? 'line-through opacity-60' : ''
          }`}
        >
          {todo.title}
        </span>
      ))}

      {overflow > 0 && (
        <span className="text-[10px] text-gray-500 dark:text-gray-400">+{overflow} more</span>
      )}
    </button>
  );
}
