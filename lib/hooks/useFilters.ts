'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useDebounce } from './useDebounce';
import {
  DEFAULT_FILTER_STATE,
  applyFilters,
  hasActiveFilters,
  type FilterState,
} from '../filters';
import {
  PresetStorageError,
  deletePreset,
  loadPresets,
  savePreset,
  type FilterPreset,
} from '../filter-presets';
import type { Tag, Todo } from '../db/types';

/**
 * Filter state, debounced search, and saved presets (PRP 08).
 *
 * Filtering runs against the *debounced* search value so a long list is not re-scanned on
 * every keystroke, while the input itself stays bound to the raw value for instant feedback.
 */
export function useFilters(todos: Todo[], tags: Tag[]) {
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTER_STATE);
  const [presets, setPresets] = useState<FilterPreset[]>([]);
  const [presetError, setPresetError] = useState<string | null>(null);

  const debouncedSearch = useDebounce(filters.search, 300);

  useEffect(() => {
    setPresets(loadPresets());
  }, []);

  // A tag deleted in another tab must not silently filter the list down to nothing.
  useEffect(() => {
    if (filters.tagId === 'all') return;
    if (!tags.some((tag) => tag.id === filters.tagId)) {
      setFilters((prev) => ({ ...prev, tagId: 'all' }));
    }
  }, [tags, filters.tagId]);

  const effectiveFilters = useMemo<FilterState>(
    // Clearing via the ✕ button sets `search` to '' directly, which reaches the debounced
    // value on the next tick; using the raw empty string here makes the clear feel immediate.
    () => ({ ...filters, search: filters.search === '' ? '' : debouncedSearch }),
    [filters, debouncedSearch],
  );

  const filteredTodos = useMemo(
    () => applyFilters(todos, effectiveFilters),
    [todos, effectiveFilters],
  );

  const isFiltered = hasActiveFilters(effectiveFilters);

  const updateFilter = useCallback(<K extends keyof FilterState>(key: K, value: FilterState[K]) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }, []);

  const clearAll = useCallback(() => setFilters(DEFAULT_FILTER_STATE), []);

  /** Applying a preset overwrites every dimension, so stale values never linger. */
  const applyPreset = useCallback(
    (preset: FilterPreset) => {
      const restored = { ...DEFAULT_FILTER_STATE, ...preset.filters };
      if (restored.tagId !== 'all' && !tags.some((tag) => tag.id === restored.tagId)) {
        restored.tagId = 'all';
      }
      setFilters(restored);
    },
    [tags],
  );

  const saveCurrentAsPreset = useCallback(
    (name: string): boolean => {
      try {
        setPresets(savePreset(name, filters));
        setPresetError(null);
        return true;
      } catch (error) {
        setPresetError(
          error instanceof PresetStorageError ? error.message : 'Could not save preset',
        );
        return false;
      }
    },
    [filters],
  );

  const removePreset = useCallback((id: string) => {
    setPresets(deletePreset(id));
  }, []);

  return {
    filters,
    setFilters,
    updateFilter,
    clearAll,
    filteredTodos,
    isFiltered,
    presets,
    presetError,
    applyPreset,
    saveCurrentAsPreset,
    removePreset,
  };
}
