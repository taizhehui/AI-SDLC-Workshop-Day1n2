'use client';

import { Modal } from '@/components/ui/Modal';
import { PriorityBadge } from '@/components/badges/PriorityBadge';
import { formatDayLabel, formatSingaporeDate } from '@/lib/timezone';
import type { Holiday, Todo } from '@/lib/db/types';

interface DayTodosModalProps {
  date: string;
  todos: Todo[];
  holiday: Holiday | undefined;
  onClose: () => void;
}

/** Read-only list of everything due on the clicked day (PRP 10). */
export function DayTodosModal({ date, todos, holiday, onClose }: DayTodosModalProps) {
  return (
    <Modal title={formatDayLabel(date)} onClose={onClose} testId="day-todos-modal">
      <div className="space-y-3">
        {holiday && (
          <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200">
            🎉 {holiday.name}
          </p>
        )}

        {todos.length === 0 ? (
          <p className="py-4 text-center text-sm text-gray-500 dark:text-gray-400">
            No todos due on this day.
          </p>
        ) : (
          <ul className="max-h-80 space-y-2 overflow-y-auto">
            {todos.map((todo) => (
              <li
                key={todo.id}
                data-testid={`day-todo-${todo.id}`}
                className="flex items-start gap-3 rounded-lg border border-gray-200 p-3 dark:border-gray-700"
              >
                <input
                  type="checkbox"
                  checked={todo.completed}
                  readOnly
                  disabled
                  aria-label={`${todo.title} is ${todo.completed ? 'complete' : 'incomplete'}`}
                  className="mt-1 h-4 w-4 rounded border-gray-300 dark:border-gray-600"
                />
                <div className="min-w-0 flex-1">
                  <p
                    className={`break-words text-sm font-medium ${
                      todo.completed
                        ? 'text-gray-400 line-through dark:text-gray-500'
                        : 'text-gray-800 dark:text-white'
                    }`}
                  >
                    {todo.title}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <PriorityBadge priority={todo.priority} />
                    {todo.due_date && (
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {formatSingaporeDate(todo.due_date, 'HH:mm')}
                      </span>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Modal>
  );
}
