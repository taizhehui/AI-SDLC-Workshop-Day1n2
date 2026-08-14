'use client';

import { useCallback } from 'react';
import { apiClient } from '../api-client';
import type { Subtask } from '../db/types';

/**
 * Subtask mutations for a single todo (PRP 05).
 *
 * The subtask list itself lives on the parent `Todo` in `useTodos`, so every mutation reports
 * the refreshed list back through `onChange` rather than holding a second copy of the state.
 */
export function useSubtasks(todoId: number, onChange: (subtasks: Subtask[]) => void) {
  const reload = useCallback(async () => {
    const subtasks = await apiClient.get<Subtask[]>(`/api/todos/${todoId}/subtasks`);
    onChange(subtasks);
  }, [todoId, onChange]);

  const addSubtask = useCallback(
    async (title: string): Promise<boolean> => {
      const trimmed = title.trim();
      if (!trimmed) return false;

      try {
        await apiClient.post<Subtask>(`/api/todos/${todoId}/subtasks`, { title: trimmed });
        await reload();
        return true;
      } catch (error) {
        console.error('Failed to add subtask:', error);
        return false;
      }
    },
    [todoId, reload],
  );

  const toggleSubtask = useCallback(
    async (subtask: Subtask): Promise<void> => {
      try {
        await apiClient.put<Subtask>(`/api/subtasks/${subtask.id}`, {
          completed: !subtask.completed,
        });
        await reload();
      } catch (error) {
        console.error('Failed to toggle subtask:', error);
      }
    },
    [reload],
  );

  const deleteSubtask = useCallback(
    async (subtaskId: number): Promise<void> => {
      try {
        await apiClient.delete(`/api/subtasks/${subtaskId}`);
        await reload();
      } catch (error) {
        console.error('Failed to delete subtask:', error);
      }
    },
    [reload],
  );

  return { addSubtask, toggleSubtask, deleteSubtask, reload };
}
