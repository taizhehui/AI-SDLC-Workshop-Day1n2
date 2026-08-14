'use client';

import { TagSelector } from '@/components/tags/TagSelector';
import type { TodoDraft } from '@/lib/hooks/useTodoForm';
import {
  REMINDER_OPTION_LABELS,
  REMINDER_VALUES,
  type Priority,
  type RecurrencePattern,
  type ReminderMinutes,
  type Tag,
} from '@/lib/db/types';

const INPUT_CLASS =
  'rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-white';

interface TodoFormFieldsProps {
  draft: TodoDraft;
  tags: Tag[];
  onFieldChange: <K extends keyof TodoDraft>(key: K, value: TodoDraft[K]) => void;
  onToggleTag: (tagId: number) => void;
  onManageTags?: () => void;
  idPrefix: string;
}

/**
 * The shared body of the create form and the edit modal — priority, due date, recurrence,
 * reminder and tags (PRPs 02, 03, 04, 06).
 *
 * Two dependency rules are enforced here rather than only server-side, so the controls
 * cannot express an invalid combination in the first place:
 *   - Repeat requires a due date (the anchor for the next occurrence).
 *   - Reminder requires a due date (nothing to count back from otherwise).
 */
export function TodoFormFields({
  draft,
  tags,
  onFieldChange,
  onToggleTag,
  onManageTags,
  idPrefix,
}: TodoFormFieldsProps) {
  const hasDueDate = draft.dueDate !== '';

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-3">
        <label className="flex flex-col gap-1 text-sm text-gray-700 dark:text-gray-300">
          Priority
          <select
            id={`${idPrefix}-priority`}
            data-testid={`${idPrefix}-priority`}
            value={draft.priority}
            onChange={(event) => onFieldChange('priority', event.target.value as Priority)}
            className={INPUT_CLASS}
          >
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm text-gray-700 dark:text-gray-300">
          Due date
          <input
            id={`${idPrefix}-due-date`}
            data-testid={`${idPrefix}-due-date`}
            type="datetime-local"
            value={draft.dueDate}
            onChange={(event) => onFieldChange('dueDate', event.target.value)}
            className={INPUT_CLASS}
          />
        </label>

        <label className="flex flex-col gap-1 text-sm text-gray-700 dark:text-gray-300">
          Reminder
          <select
            id={`${idPrefix}-reminder`}
            data-testid={`${idPrefix}-reminder`}
            value={draft.reminderMinutes ?? ''}
            disabled={!hasDueDate}
            onChange={(event) =>
              onFieldChange(
                'reminderMinutes',
                event.target.value ? (Number(event.target.value) as ReminderMinutes) : null,
              )
            }
            className={`${INPUT_CLASS} disabled:opacity-50`}
          >
            <option value="">None</option>
            {REMINDER_VALUES.map((minutes) => (
              <option key={minutes} value={minutes}>
                {REMINDER_OPTION_LABELS[minutes]}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-1 text-sm text-gray-700 dark:text-gray-300">
          <input
            id={`${idPrefix}-repeat`}
            data-testid={`${idPrefix}-repeat`}
            type="checkbox"
            checked={draft.isRecurring}
            disabled={!hasDueDate}
            onChange={(event) => onFieldChange('isRecurring', event.target.checked)}
            className="h-4 w-4 rounded border-gray-300 dark:border-gray-600"
          />
          Repeat
        </label>

        {draft.isRecurring && (
          <select
            id={`${idPrefix}-pattern`}
            data-testid={`${idPrefix}-pattern`}
            value={draft.recurrencePattern}
            onChange={(event) =>
              onFieldChange('recurrencePattern', event.target.value as RecurrencePattern)
            }
            className={INPUT_CLASS}
            aria-label="Recurrence pattern"
          >
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
            <option value="yearly">Yearly</option>
          </select>
        )}

        {!hasDueDate && (
          <span className="text-xs text-gray-500 dark:text-gray-400">
            Set a due date to enable repeat and reminders
          </span>
        )}
      </div>

      <TagSelector
        tags={tags}
        selectedIds={draft.tagIds}
        onToggle={onToggleTag}
        onManage={onManageTags}
      />
    </div>
  );
}
