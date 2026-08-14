'use client';

import { PriorityBadge } from '@/components/badges/PriorityBadge';
import { RecurrenceBadge } from '@/components/badges/RecurrenceBadge';
import { ReminderBadge } from '@/components/badges/ReminderBadge';
import { SubtaskList } from '@/components/subtasks/SubtaskList';
import { TagPill } from '@/components/tags/TagPill';
import { formatDueDate } from '@/lib/timezone';
import type { Subtask, Tag, Todo } from '@/lib/db/types';

interface TodoItemProps {
  todo: Todo;
  onToggle: (id: number, completed: boolean) => void;
  onEdit: (todo: Todo) => void;
  onDelete: (id: number) => void;
  onSubtasksChange: (todoId: number, subtasks: Subtask[]) => void;
  onTagClick: (tag: Tag) => void;
}

/** One todo row: checkbox, title, badges, tags, and its collapsible checklist. */
export function TodoItem({
  todo,
  onToggle,
  onEdit,
  onDelete,
  onSubtasksChange,
  onTagClick,
}: TodoItemProps) {
  return (
    <li
      data-testid={`todo-item-${todo.id}`}
      data-todo-title={todo.title}
      className="rounded-lg bg-white p-4 shadow-sm dark:bg-gray-800"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <input
            type="checkbox"
            checked={todo.completed}
            onChange={(event) => onToggle(todo.id, event.target.checked)}
            aria-label={`Mark "${todo.title}" as ${todo.completed ? 'incomplete' : 'complete'}`}
            data-testid={`todo-checkbox-${todo.id}`}
            className="mt-1 h-5 w-5 shrink-0 rounded border-gray-300 dark:border-gray-600"
          />

          <div className="min-w-0 flex-1">
            <p
              className={`break-words font-medium ${
                todo.completed
                  ? 'text-gray-400 line-through dark:text-gray-500'
                  : 'text-gray-800 dark:text-white'
              }`}
            >
              {todo.title}
            </p>

            <div className="mt-1 flex flex-wrap items-center gap-2">
              <PriorityBadge priority={todo.priority} />
              {todo.is_recurring && todo.recurrence_pattern && (
                <RecurrenceBadge pattern={todo.recurrence_pattern} />
              )}
              {todo.reminder_minutes != null && (
                <ReminderBadge minutes={todo.reminder_minutes} />
              )}
              {todo.due_date && (
                <span
                  data-testid={`todo-due-${todo.id}`}
                  className="text-sm text-gray-500 dark:text-gray-400"
                >
                  {formatDueDate(todo.due_date)}
                </span>
              )}
            </div>

            {todo.tags && todo.tags.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {todo.tags.map((tag) => (
                  // Clicking a pill on a card applies it as the active tag filter.
                  <TagPill key={tag.id} tag={tag} selected onClick={onTagClick} />
                ))}
              </div>
            )}

            <SubtaskList
              todoId={todo.id}
              subtasks={todo.subtasks ?? []}
              onChange={(subtasks) => onSubtasksChange(todo.id, subtasks)}
            />
          </div>
        </div>

        <div className="flex shrink-0 gap-3 text-sm">
          <button
            type="button"
            onClick={() => onEdit(todo)}
            data-testid={`todo-edit-${todo.id}`}
            className="text-blue-600 hover:underline dark:text-blue-400"
          >
            Edit
          </button>
          <button
            type="button"
            onClick={() => onDelete(todo.id)}
            data-testid={`todo-delete-${todo.id}`}
            className="text-red-600 hover:underline dark:text-red-400"
          >
            Delete
          </button>
        </div>
      </div>
    </li>
  );
}
