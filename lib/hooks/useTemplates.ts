'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiClient } from '../api-client';
import type { CreateTemplateDto, Template, Todo } from '../db/types';

/** Owns the user's template library and the "use template" action (PRP 07). */
export function useTemplates() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setTemplates(await apiClient.get<Template[]>('/api/templates'));
      setError(null);
    } catch (err) {
      console.error('Failed to load templates:', err);
      setError('Could not load templates.');
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const createTemplate = useCallback(
    async (input: CreateTemplateDto): Promise<Template | null> => {
      try {
        const template = await apiClient.post<Template>('/api/templates', input);
        setTemplates((prev) => [template, ...prev]);
        setError(null);
        return template;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not save template.');
        return null;
      }
    },
    [],
  );

  const deleteTemplate = useCallback(async (id: number): Promise<boolean> => {
    try {
      await apiClient.delete(`/api/templates/${id}`);
      setTemplates((prev) => prev.filter((template) => template.id !== id));
      setError(null);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete template.');
      return false;
    }
  }, []);

  /** Creates a todo from the template and returns it so the caller can add it to the list. */
  const useTemplate = useCallback(async (id: number): Promise<Todo | null> => {
    try {
      const todo = await apiClient.post<Todo>(`/api/templates/${id}/use`);
      setError(null);
      return todo;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create todo from template.');
      return null;
    }
  }, []);

  return { templates, error, setError, refresh, createTemplate, deleteTemplate, useTemplate };
}
