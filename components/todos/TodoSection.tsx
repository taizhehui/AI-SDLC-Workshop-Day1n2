'use client';

import { TodoItem } from './TodoItem';
import type { Subtask, Tag, Todo } from '@/lib/db/types';

export type SectionTone = 'overdue' | 'pending' | 'completed';

const TONE_STYLES: Record<SectionTone, string> = {
  overdue: 'text-red-600 dark:text-red-400',
  pending: 'text-gray-700 dark:text-gray-300',
  completed: 'text-green-600 dark:text-green-400',
};

interface TodoSectionProps {
  title: string;
  tone: SectionTone;
  todos: Todo[];
  onToggle: (id: number, completed: boolean) => void;
  onEdit: (todo: Todo) => void;
  onDelete: (id: number) => void;
  onSubtasksChange: (todoId: number, subtasks: Subtask[]) => void;
  onTagClick: (tag: Tag) => void;
}

/**
 * One rendered section with a live count in its heading.
 *
 * A section with no matching todos renders nothing at all rather than an empty shell.
 */
export function TodoSection({
  title,
  tone,
  todos,
  onToggle,
  onEdit,
  onDelete,
  onSubtasksChange,
  onTagClick,
}: TodoSectionProps) {
  if (todos.length === 0) return null;

  return (
    <section data-testid={`section-${tone}`} className="space-y-2">
      <h2 className={`text-sm font-semibold uppercase tracking-wide ${TONE_STYLES[tone]}`}>
        <span data-testid={`section-${tone}-heading`}>
          {title} ({todos.length})
        </span>
      </h2>

      <ul className="space-y-2">
        {todos.map((todo) => (
          <TodoItem
            key={todo.id}
            todo={todo}
            onToggle={onToggle}
            onEdit={onEdit}
            onDelete={onDelete}
            onSubtasksChange={onSubtasksChange}
            onTagClick={onTagClick}
          />
        ))}
      </ul>
    </section>
  );
}
