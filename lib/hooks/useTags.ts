'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiClient } from '../api-client';
import type { CreateTagInput, Tag, UpdateTagInput } from '../db/types';

/** Owns the user's tag set and its CRUD operations (PRP 06). */
export function useTags() {
  const [tags, setTags] = useState<Tag[]>([]);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setTags(await apiClient.get<Tag[]>('/api/tags'));
      setError(null);
    } catch (err) {
      console.error('Failed to load tags:', err);
      setError('Could not load tags.');
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const createTag = useCallback(async (input: CreateTagInput): Promise<Tag | null> => {
    try {
      const tag = await apiClient.post<Tag>('/api/tags', input);
      setTags((prev) => [...prev, tag].sort(byName));
      setError(null);
      return tag;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create tag.');
      return null;
    }
  }, []);

  const updateTag = useCallback(
    async (id: number, input: UpdateTagInput): Promise<Tag | null> => {
      try {
        const tag = await apiClient.put<Tag>(`/api/tags/${id}`, input);
        setTags((prev) => prev.map((existing) => (existing.id === id ? tag : existing)).sort(byName));
        setError(null);
        return tag;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not update tag.');
        return null;
      }
    },
    [],
  );

  const deleteTag = useCallback(async (id: number): Promise<boolean> => {
    try {
      await apiClient.delete(`/api/tags/${id}`);
      setTags((prev) => prev.filter((tag) => tag.id !== id));
      setError(null);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete tag.');
      return false;
    }
  }, []);

  return { tags, error, setError, refresh, createTag, updateTag, deleteTag };
}

const byName = (a: Tag, b: Tag): number =>
  a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
