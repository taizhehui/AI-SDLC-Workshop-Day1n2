'use client';

import { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Banner } from '@/components/ui/Banner';
import { TodoFormFields } from './TodoFormFields';
import {
  draftFromTodo,
  draftToInput,
  useTodoForm,
  validateDraft,
} from '@/lib/hooks/useTodoForm';
import type { Tag, Todo, UpdateTodoInput } from '@/lib/db/types';

interface TodoEditModalProps {
  todo: Todo;
  tags: Tag[];
  onClose: () => void;
  onSave: (id: number, patch: UpdateTodoInput) => Promise<unknown>;
}

/**
 * Edit an existing todo (PRP 01).
 *
 * Cancel, the ✕ button, backdrop click and Escape all close without an API call, so a
 * discarded edit never touches the server.
 */
export function TodoEditModal({ todo, tags, onClose, onSave }: TodoEditModalProps) {
  const { draft, setField, toggleTag } = useTodoForm(draftFromTodo(todo));
  const [validationError, setValidationError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    // An existing todo may already be overdue; re-imposing the "1 minute out" rule would make
    // it impossible to edit the title of an overdue item without also moving its due date.
    const dueDateUnchanged = draft.dueDate === draftFromTodo(todo).dueDate;
    const error = validateDraft(draft, { skipDueDateLead: dueDateUnchanged });
    if (error) {
      setValidationError(error);
      return;
    }

    setValidationError(null);
    setSaving(true);
    try {
      await onSave(todo.id, draftToInput(draft) as UpdateTodoInput);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title="Edit todo" onClose={onClose} testId="todo-edit-modal">
      <div className="space-y-4">
        <label className="flex flex-col gap-1 text-sm text-gray-700 dark:text-gray-300">
          Title
          <input
            type="text"
            value={draft.title}
            onChange={(event) => setField('title', event.target.value)}
            data-testid="edit-title-input"
            className="rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
          />
        </label>

        <TodoFormFields
          draft={draft}
          tags={tags}
          onFieldChange={setField}
          onToggleTag={toggleTag}
          idPrefix="edit"
        />

        {validationError && (
          <Banner tone="error" testId="edit-form-error">
            {validationError}
          </Banner>
        )}

        <div className="flex justify-end gap-2 border-t border-gray-200 pt-4 dark:border-gray-700">
          <button
            type="button"
            onClick={onClose}
            data-testid="cancel-edit-button"
            className="rounded-md px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !draft.title.trim()}
            data-testid="update-todo-button"
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Update'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
