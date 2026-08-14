'use client';

import { useMemo } from 'react';
import { TodoSection } from './TodoSection';
import { sectionTodos } from '@/lib/todo-sort';
import { getSingaporeNow } from '@/lib/timezone';
import type { Subtask, Tag, Todo } from '@/lib/db/types';

interface TodoListProps {
  todos: Todo[];
  /** Whether the user has any todos at all, before filtering. */
  hasAnyTodos: boolean;
  isFiltered: boolean;
  loading: boolean;
  onToggle: (id: number, completed: boolean) => void;
  onEdit: (todo: Todo) => void;
  onDelete: (id: number) => void;
  onSubtasksChange: (todoId: number, subtasks: Subtask[]) => void;
  onTagClick: (tag: Tag) => void;
}

/**
 * The three rendered sections (PRP 01).
 *
 * Sectioning is recomputed from the current list on every render, so changing a due date,
 * priority, or completion state re-sorts and re-sections immediately with no manual step.
 */
export function TodoList({
  todos,
  hasAnyTodos,
  isFiltered,
  loading,
  onToggle,
  onEdit,
  onDelete,
  onSubtasksChange,
  onTagClick,
}: TodoListProps) {
  const sections = useMemo(() => sectionTodos(todos, getSingaporeNow()), [todos]);

  if (loading) {
    return (
      <p className="py-8 text-center text-gray-500 dark:text-gray-400">Loading your todos…</p>
    );
  }

  if (todos.length === 0) {
    // Distinct copy for the two empty states — otherwise a filter that matches nothing looks
    // like the list itself was wiped.
    return (
      <p
        data-testid={hasAnyTodos && isFiltered ? 'empty-filtered' : 'empty-no-todos'}
        className="rounded-xl bg-white py-12 text-center text-gray-500 shadow-sm dark:bg-gray-800 dark:text-gray-400"
      >
        {hasAnyTodos && isFiltered
          ? 'No todos match your filters.'
          : 'You have no todos yet. Add your first one above.'}
      </p>
    );
  }

  const handlers = { onToggle, onEdit, onDelete, onSubtasksChange, onTagClick };

  return (
    <div className="space-y-6">
      <TodoSection title="Overdue" tone="overdue" todos={sections.overdue} {...handlers} />
      <TodoSection title="Pending" tone="pending" todos={sections.pending} {...handlers} />
      <TodoSection title="Completed" tone="completed" todos={sections.completed} {...handlers} />
    </div>
  );
}
