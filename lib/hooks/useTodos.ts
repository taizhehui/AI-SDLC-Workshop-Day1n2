'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiClient } from '../api-client';
import { toSingaporeTimestamp } from '../timezone';
import type { CreateTodoInput, Subtask, Todo, UpdateTodoInput } from '../db/types';

interface UpdateResponse {
  todo: Todo;
  nextInstance: Todo | null;
}

/**
 * Owns the todo collection and every mutation against it (PRP 01, 03, 05).
 *
 * Create, toggle, and delete apply optimistically so the UI reflects the action within one
 * render, then reconcile with the server response — or roll back cleanly on failure.
 */
export function useTodos() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setTodos(await apiClient.get<Todo[]>('/api/todos'));
      setError(null);
    } catch (err) {
      console.error('Failed to load todos:', err);
      setError('Could not load your todos. Please refresh the page.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const createTodo = useCallback(async (input: CreateTodoInput): Promise<Todo | null> => {
    // Negative id marks the optimistic row; it is swapped for the server row on success.
    const optimisticId = -Date.now();
    const optimistic: Todo = {
      id: optimisticId,
      user_id: 0,
      title: input.title,
      completed: false,
      due_date: input.due_date ?? null,
      priority: input.priority ?? 'medium',
      is_recurring: input.is_recurring ?? false,
      recurrence_pattern: input.recurrence_pattern ?? null,
      reminder_minutes: input.reminder_minutes ?? null,
      last_notification_sent: null,
      created_at: toSingaporeTimestamp(),
      updated_at: null,
      subtasks: [],
      tags: [],
    };

    setTodos((prev) => [...prev, optimistic]);
    setError(null);

    try {
      const saved = await apiClient.post<Todo>('/api/todos', input);
      setTodos((prev) => {
        // Upsert rather than map: an in-flight `refresh()` can replace the whole list and
        // discard the optimistic row, and a plain map would then drop the saved todo too.
        const withoutOptimistic = prev.filter((todo) => todo.id !== optimisticId);
        return withoutOptimistic.some((todo) => todo.id === saved.id)
          ? withoutOptimistic.map((todo) => (todo.id === saved.id ? saved : todo))
          : [...withoutOptimistic, saved];
      });
      return saved;
    } catch (err) {
      setTodos((prev) => prev.filter((todo) => todo.id !== optimisticId));
      setError(err instanceof Error ? err.message : 'Could not create todo. Please try again.');
      return null;
    }
  }, []);

  const updateTodo = useCallback(
    async (id: number, patch: UpdateTodoInput): Promise<Todo | null> => {
      // Snapshot inside the updater so the rollback restores the list as it actually was at
      // mutation time, not a value captured when the callback was created.
      let snapshot: Todo[] = [];
      setTodos((prev) => {
        snapshot = prev;
        // Apply locally first so checkbox toggles and edits feel instant.
        return prev.map((todo) => (todo.id === id ? applyPatchLocally(todo, patch) : todo));
      });
      setError(null);

      try {
        const { todo, nextInstance } = await apiClient.put<UpdateResponse>(
          `/api/todos/${id}`,
          patch,
        );
        setTodos((prev) => {
          const merged = prev.map((existing) => (existing.id === id ? todo : existing));
          // A completed recurring todo returns its freshly-created next occurrence.
          if (!nextInstance) return merged;
          return merged.some((existing) => existing.id === nextInstance.id)
            ? merged
            : [...merged, nextInstance];
        });
        return todo;
      } catch (err) {
        setTodos(snapshot);
        setError(err instanceof Error ? err.message : 'Could not update todo. Please try again.');
        return null;
      }
    },
    [],
  );

  const deleteTodo = useCallback(async (id: number): Promise<boolean> => {
    let snapshot: Todo[] = [];
    setTodos((prev) => {
      snapshot = prev;
      return prev.filter((todo) => todo.id !== id);
    });
    setError(null);

    try {
      await apiClient.delete(`/api/todos/${id}`);
      return true;
    } catch (err) {
      setTodos(snapshot);
      setError(err instanceof Error ? err.message : 'Could not delete todo. Please try again.');
      return false;
    }
  }, []);

  const toggleTodo = useCallback(
    (id: number, completed: boolean) => updateTodo(id, { completed }),
    [updateTodo],
  );

  const replaceSubtasks = useCallback((todoId: number, subtasks: Subtask[]) => {
    setTodos((prev) =>
      prev.map((todo) => (todo.id === todoId ? { ...todo, subtasks } : todo)),
    );
  }, []);

  const addTodoLocally = useCallback((todo: Todo) => {
    setTodos((prev) => [...prev, todo]);
  }, []);

  return {
    todos,
    loading,
    error,
    setError,
    refresh,
    createTodo,
    updateTodo,
    deleteTodo,
    toggleTodo,
    replaceSubtasks,
    addTodoLocally,
  };
}

/** Immutable local merge used for the optimistic phase of an update. */
function applyPatchLocally(todo: Todo, patch: UpdateTodoInput): Todo {
  return {
    ...todo,
    ...(patch.title !== undefined ? { title: patch.title } : {}),
    ...(patch.completed !== undefined ? { completed: patch.completed } : {}),
    ...(patch.due_date !== undefined ? { due_date: patch.due_date } : {}),
    ...(patch.priority !== undefined ? { priority: patch.priority } : {}),
    ...(patch.is_recurring !== undefined ? { is_recurring: patch.is_recurring } : {}),
    ...(patch.recurrence_pattern !== undefined
      ? { recurrence_pattern: patch.recurrence_pattern }
      : {}),
    ...(patch.reminder_minutes !== undefined
      ? { reminder_minutes: patch.reminder_minutes }
      : {}),
    updated_at: toSingaporeTimestamp(),
  };
}
