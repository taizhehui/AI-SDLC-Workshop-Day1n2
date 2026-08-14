'use client';

import { useCallback, useState } from 'react';
import { getSingaporeNow, toDateTimeLocalValue, tryParseSingaporeDate } from '../timezone';
import { MIN_DUE_DATE_LEAD_MS } from '../validation';
import type {
  CreateTodoInput,
  Priority,
  RecurrencePattern,
  ReminderMinutes,
  Todo,
} from '../db/types';

/**
 * Draft state for the todo create form and edit modal.
 *
 * Both surfaces share this shape so validation, defaults, and the "save as template" payload
 * stay identical between them.
 */
export interface TodoDraft {
  title: string;
  priority: Priority;
  /** `<input type="datetime-local">` value (`YYYY-MM-DDTHH:mm`), or ''. */
  dueDate: string;
  isRecurring: boolean;
  recurrencePattern: RecurrencePattern;
  reminderMinutes: ReminderMinutes | null;
  tagIds: number[];
}

export const EMPTY_DRAFT: TodoDraft = {
  title: '',
  priority: 'medium',
  dueDate: '',
  isRecurring: false,
  recurrencePattern: 'weekly',
  reminderMinutes: null,
  tagIds: [],
};

export function draftFromTodo(todo: Todo): TodoDraft {
  return {
    title: todo.title,
    priority: todo.priority,
    dueDate: todo.due_date ? toDateTimeLocalValue(todo.due_date) : '',
    isRecurring: todo.is_recurring,
    recurrencePattern: todo.recurrence_pattern ?? 'weekly',
    reminderMinutes: (todo.reminder_minutes as ReminderMinutes | null) ?? null,
    tagIds: (todo.tags ?? []).map((tag) => tag.id),
  };
}

/**
 * Client-side validation, mirroring the server rules so the user gets immediate feedback.
 * The server re-checks everything against its own clock — this is convenience, not the gate.
 */
export function validateDraft(draft: TodoDraft, options?: { skipDueDateLead?: boolean }): string | null {
  if (!draft.title.trim()) {
    return 'Title is required';
  }

  if (draft.dueDate) {
    const parsed = tryParseSingaporeDate(draft.dueDate);
    if (!parsed) return 'Due date is not a valid date';

    if (
      !options?.skipDueDateLead &&
      parsed.getTime() < getSingaporeNow().getTime() + MIN_DUE_DATE_LEAD_MS
    ) {
      return 'Due date must be at least 1 minute in the future';
    }
  }

  if (draft.isRecurring && !draft.dueDate) {
    return 'Recurring todos require a due date';
  }

  return null;
}

/** Convert a draft into the API payload. */
export function draftToInput(draft: TodoDraft): CreateTodoInput {
  return {
    title: draft.title.trim(),
    due_date: draft.dueDate || null,
    priority: draft.priority,
    is_recurring: draft.isRecurring,
    recurrence_pattern: draft.isRecurring ? draft.recurrencePattern : null,
    reminder_minutes: draft.dueDate ? draft.reminderMinutes : null,
    tag_ids: draft.tagIds,
  };
}

export function useTodoForm(initial: TodoDraft = EMPTY_DRAFT) {
  const [draft, setDraft] = useState<TodoDraft>(initial);

  const setField = useCallback(
    <K extends keyof TodoDraft>(key: K, value: TodoDraft[K]) => {
      setDraft((prev) => {
        const next = { ...prev, [key]: value };

        // Reminders and recurrence both hang off the due date; clearing it clears them too,
        // rather than leaving an orphaned setting the server would reject.
        if (key === 'dueDate' && value === '') {
          next.reminderMinutes = null;
          next.isRecurring = false;
        }
        return next;
      });
    },
    [],
  );

  const toggleTag = useCallback((tagId: number) => {
    setDraft((prev) => ({
      ...prev,
      tagIds: prev.tagIds.includes(tagId)
        ? prev.tagIds.filter((id) => id !== tagId)
        : [...prev.tagIds, tagId],
    }));
  }, []);

  const reset = useCallback((next: TodoDraft = EMPTY_DRAFT) => setDraft(next), []);

  return { draft, setDraft, setField, toggleTag, reset };
}
