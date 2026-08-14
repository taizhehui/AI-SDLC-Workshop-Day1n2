'use client';

import { PriorityBadge } from '@/components/badges/PriorityBadge';
import { RecurrenceBadge } from '@/components/badges/RecurrenceBadge';
import { ReminderBadge } from '@/components/badges/ReminderBadge';
import { parseTemplateSubtasks } from '@/lib/template-subtasks';
import type { Template } from '@/lib/db/types';

interface TemplateCardProps {
  template: Template;
  onUse: (id: number) => void;
  onDelete?: (id: number) => void;
}

/** Template summary card, shared by the manager modal (PRP 07). */
export function TemplateCard({ template, onUse, onDelete }: TemplateCardProps) {
  const subtaskCount = parseTemplateSubtasks(template.subtasks_json).length;

  const handleDelete = () => {
    if (!onDelete) return;
    if (!window.confirm(`Delete the template "${template.name}"?`)) return;
    onDelete(template.id);
  };

  return (
    <div
      data-testid={`template-card-${template.id}`}
      data-template-name={template.name}
      className="rounded-lg border border-gray-200 p-3 dark:border-gray-700"
    >
      <div className="flex flex-wrap items-center gap-2">
        <strong className="text-gray-900 dark:text-white">{template.name}</strong>
        {template.category && (
          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600 dark:bg-gray-700 dark:text-gray-300">
            {template.category}
          </span>
        )}
      </div>

      {template.description && (
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{template.description}</p>
      )}

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <PriorityBadge priority={template.priority} />
        {template.is_recurring && template.recurrence_pattern && (
          <RecurrenceBadge pattern={template.recurrence_pattern} />
        )}
        {template.reminder_minutes != null && (
          <ReminderBadge minutes={template.reminder_minutes} />
        )}
        {subtaskCount > 0 && (
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {subtaskCount} subtask{subtaskCount === 1 ? '' : 's'}
          </span>
        )}
      </div>

      <div className="mt-3 flex gap-3 text-sm">
        <button
          type="button"
          onClick={() => onUse(template.id)}
          data-testid={`use-template-${template.id}`}
          className="font-medium text-blue-600 hover:underline dark:text-blue-400"
        >
          Use
        </button>
        {onDelete && (
          <button
            type="button"
            onClick={handleDelete}
            data-testid={`delete-template-${template.id}`}
            className="font-medium text-red-600 hover:underline dark:text-red-400"
          >
            Delete
          </button>
        )}
      </div>
    </div>
  );
}
