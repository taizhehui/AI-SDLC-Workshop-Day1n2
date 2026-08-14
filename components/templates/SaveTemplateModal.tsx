'use client';

import { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Banner } from '@/components/ui/Banner';
import type { TodoDraft } from '@/lib/hooks/useTodoForm';
import {
  TEMPLATE_CATEGORY_SUGGESTIONS,
  type CreateTemplateDto,
  type Template,
} from '@/lib/db/types';

interface SaveTemplateModalProps {
  draft: TodoDraft;
  error: string | null;
  onClose: () => void;
  onSave: (input: CreateTemplateDto) => Promise<Template | null>;
}

/**
 * Capture the current todo-form state as a reusable template (PRP 07).
 *
 * A concrete due date is never stored — only how far ahead of "use" time the todo should be
 * due, so the same template stays valid a month later. Tags are excluded entirely.
 */
export function SaveTemplateModal({ draft, error, onClose, onSave }: SaveTemplateModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [offsetMinutes, setOffsetMinutes] = useState('');
  const [saving, setSaving] = useState(false);

  const parsedOffset = offsetMinutes.trim() === '' ? null : Number(offsetMinutes);
  const offsetInvalid = parsedOffset !== null && !Number.isFinite(parsedOffset);

  // Mirrors the server invariant: a recurring template needs an offset to anchor its first
  // due date, otherwise the todo it creates would violate PRP 03.
  const recurringNeedsOffset = draft.isRecurring && parsedOffset === null;

  const handleSave = async () => {
    if (!name.trim() || offsetInvalid || recurringNeedsOffset) return;

    setSaving(true);
    try {
      const saved = await onSave({
        name: name.trim(),
        description: description.trim() || null,
        category: category.trim() || null,
        title_template: draft.title.trim(),
        priority: draft.priority,
        is_recurring: draft.isRecurring,
        recurrence_pattern: draft.isRecurring ? draft.recurrencePattern : null,
        reminder_minutes: draft.reminderMinutes,
        due_date_offset_minutes: parsedOffset,
      });
      if (saved) onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title="Save as Template" onClose={onClose} testId="save-template-modal">
      <div className="space-y-3">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Captures “{draft.title.trim()}” with its priority, recurrence and reminder. Tags and a
          fixed due date are not saved.
        </p>

        <label className="flex flex-col gap-1 text-sm text-gray-700 dark:text-gray-300">
          Name
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Template name"
            data-testid="template-name-input"
            className="rounded-md border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm text-gray-700 dark:text-gray-300">
          Description (optional)
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={2}
            data-testid="template-description-input"
            className="rounded-md border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm text-gray-700 dark:text-gray-300">
          Category (optional)
          <input
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            list="template-category-suggestions"
            placeholder="Work, Personal, Finance…"
            data-testid="template-category-input"
            className="rounded-md border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
          />
          <datalist id="template-category-suggestions">
            {TEMPLATE_CATEGORY_SUGGESTIONS.map((suggestion) => (
              <option key={suggestion} value={suggestion} />
            ))}
          </datalist>
        </label>

        <label className="flex flex-col gap-1 text-sm text-gray-700 dark:text-gray-300">
          Due in (minutes from use, optional)
          <input
            type="number"
            value={offsetMinutes}
            onChange={(event) => setOffsetMinutes(event.target.value)}
            placeholder="e.g. 1440 for one day"
            data-testid="template-offset-input"
            className="rounded-md border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
          />
        </label>

        {recurringNeedsOffset && (
          <Banner tone="error">
            A repeating template needs a due-date offset so its first occurrence has an anchor.
          </Banner>
        )}
        {error && <Banner tone="error">{error}</Banner>}

        <div className="flex justify-end gap-2 border-t border-gray-200 pt-3 dark:border-gray-700">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !name.trim() || offsetInvalid || recurringNeedsOffset}
            data-testid="save-template-button"
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save Template'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
