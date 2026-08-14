'use client';

import { useState } from 'react';
import { TodoFormFields } from './TodoFormFields';
import { TemplatePicker } from '@/components/templates/TemplatePicker';
import { Banner } from '@/components/ui/Banner';
import {
  EMPTY_DRAFT,
  draftToInput,
  useTodoForm,
  validateDraft,
  type TodoDraft,
} from '@/lib/hooks/useTodoForm';
import type { CreateTodoInput, Tag, Template } from '@/lib/db/types';

interface TodoFormProps {
  tags: Tag[];
  templates: Template[];
  onCreate: (input: CreateTodoInput) => Promise<unknown>;
  onManageTags: () => void;
  onSaveAsTemplate: (draft: TodoDraft) => void;
  onUseTemplate: (templateId: number) => void;
}

/** Create-todo form: title plus every optional field, and the template shortcuts (PRP 01). */
export function TodoForm({
  tags,
  templates,
  onCreate,
  onManageTags,
  onSaveAsTemplate,
  onUseTemplate,
}: TodoFormProps) {
  const { draft, setField, toggleTag, reset } = useTodoForm();
  const [validationError, setValidationError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    const error = validateDraft(draft);
    if (error) {
      setValidationError(error);
      return;
    }

    setValidationError(null);
    setSubmitting(true);
    try {
      await onCreate(draftToInput(draft));
      reset(EMPTY_DRAFT);
    } finally {
      setSubmitting(false);
    }
  };

  const titleTooLong = draft.title.length > 200;

  return (
    <form
      onSubmit={handleSubmit}
      data-testid="todo-form"
      className="space-y-3 rounded-xl bg-white p-4 shadow-sm dark:bg-gray-800"
    >
      <div className="flex flex-wrap gap-2">
        <input
          type="text"
          value={draft.title}
          onChange={(event) => setField('title', event.target.value)}
          placeholder="What needs doing?"
          aria-label="Todo title"
          data-testid="todo-title-input"
          className="min-w-0 flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
        />
        <button
          type="submit"
          disabled={submitting || !draft.title.trim()}
          data-testid="add-todo-button"
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {submitting ? 'Adding…' : 'Add'}
        </button>
      </div>

      {titleTooLong && (
        <p className="text-xs text-amber-600 dark:text-amber-400">
          That title is quite long ({draft.title.length} characters) — consider shortening it.
        </p>
      )}

      <TodoFormFields
        draft={draft}
        tags={tags}
        onFieldChange={setField}
        onToggleTag={toggleTag}
        onManageTags={onManageTags}
        idPrefix="create"
      />

      <div className="flex flex-wrap items-center gap-2 border-t border-gray-200 pt-3 dark:border-gray-700">
        <TemplatePicker templates={templates} onUse={onUseTemplate} />

        {/* Only offered once there is a title to capture — matches PRP 07's user flow. */}
        {draft.title.trim() && (
          <button
            type="button"
            onClick={() => onSaveAsTemplate(draft)}
            data-testid="save-as-template-button"
            className="rounded-md bg-gray-100 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
          >
            💾 Save as Template
          </button>
        )}
      </div>

      {validationError && (
        <Banner tone="error" testId="todo-form-error" onDismiss={() => setValidationError(null)}>
          {validationError}
        </Banner>
      )}
    </form>
  );
}
