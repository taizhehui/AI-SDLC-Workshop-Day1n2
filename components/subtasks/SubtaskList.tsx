'use client';

import { useState } from 'react';
import { ProgressBar } from './ProgressBar';
import { useSubtasks } from '@/lib/hooks/useSubtasks';
import { calculateProgress } from '@/lib/progress';
import type { Subtask } from '@/lib/db/types';

interface SubtaskListProps {
  todoId: number;
  subtasks: Subtask[];
  onChange: (subtasks: Subtask[]) => void;
}

/**
 * Collapsible checklist for one todo (PRP 05).
 *
 * The progress bar stays visible when the list is collapsed, so progress is readable without
 * expanding every todo. Subtask completion is fully independent of the parent todo's own
 * `completed` flag in both directions.
 */
export function SubtaskList({ todoId, subtasks, onChange }: SubtaskListProps) {
  const [expanded, setExpanded] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const { addSubtask, toggleSubtask, deleteSubtask } = useSubtasks(todoId, onChange);

  const progress = calculateProgress(subtasks);

  const handleAdd = async () => {
    if (!newTitle.trim()) return;
    if (await addSubtask(newTitle)) setNewTitle('');
  };

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        aria-expanded={expanded}
        data-testid={`subtasks-toggle-${todoId}`}
        className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
      >
        {expanded ? '▼' : '▶'} Subtasks
      </button>

      <ProgressBar {...progress} />

      {expanded && (
        <div className="mt-2 space-y-1 pl-4" data-testid={`subtask-list-${todoId}`}>
          {subtasks.map((subtask) => (
            <div key={subtask.id} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={subtask.completed}
                onChange={() => void toggleSubtask(subtask)}
                aria-label={`Mark subtask "${subtask.title}" as ${
                  subtask.completed ? 'incomplete' : 'complete'
                }`}
                className="h-4 w-4 rounded border-gray-300 dark:border-gray-600"
              />
              <span
                className={`min-w-0 flex-1 break-words text-sm ${
                  subtask.completed
                    ? 'text-gray-400 line-through dark:text-gray-500'
                    : 'text-gray-700 dark:text-gray-200'
                }`}
              >
                {subtask.title}
              </span>
              <button
                type="button"
                onClick={() => void deleteSubtask(subtask.id)}
                aria-label={`Delete subtask "${subtask.title}"`}
                className="shrink-0 text-red-500 hover:text-red-600"
              >
                ✕
              </button>
            </div>
          ))}

          <div className="mt-1 flex gap-2">
            <input
              type="text"
              value={newTitle}
              onChange={(event) => setNewTitle(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  void handleAdd();
                }
              }}
              placeholder="Add subtask..."
              aria-label="New subtask title"
              data-testid={`subtask-input-${todoId}`}
              className="min-w-0 flex-1 rounded border border-gray-300 px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            />
            <button
              type="button"
              onClick={() => void handleAdd()}
              disabled={!newTitle.trim()}
              data-testid={`subtask-add-${todoId}`}
              className="text-sm font-medium text-blue-600 disabled:opacity-50 dark:text-blue-400"
            >
              Add
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
