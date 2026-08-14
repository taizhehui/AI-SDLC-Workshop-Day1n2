import { DEFAULT_FILTER_STATE, type FilterState } from './filters';
import { toSingaporeTimestamp } from './timezone';

/**
 * Saved filter presets, persisted in `localStorage` (PRP 08).
 *
 * Presets are per-browser and never synced server-side. Every read is defensive: corrupted
 * or foreign data must degrade to "no saved presets", never crash the app.
 */

export interface FilterPreset {
  id: string;
  name: string;
  filters: FilterState;
  /** ISO-ish Singapore timestamp. */
  createdAt: string;
}

export const PRESETS_KEY = 'todo-app:filter-presets';

export class PresetStorageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PresetStorageError';
  }
}

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

/** Narrow untrusted parsed JSON into a `FilterPreset`, or return null. */
function coercePreset(value: unknown): FilterPreset | null {
  if (typeof value !== 'object' || value === null) return null;
  const candidate = value as Partial<FilterPreset>;
  if (typeof candidate.id !== 'string' || typeof candidate.name !== 'string') return null;
  if (typeof candidate.filters !== 'object' || candidate.filters === null) return null;

  const raw = candidate.filters as Partial<FilterState>;
  return {
    id: candidate.id,
    name: candidate.name,
    createdAt: typeof candidate.createdAt === 'string' ? candidate.createdAt : '',
    filters: {
      search: typeof raw.search === 'string' ? raw.search : DEFAULT_FILTER_STATE.search,
      priority:
        raw.priority === 'high' || raw.priority === 'medium' || raw.priority === 'low'
          ? raw.priority
          : 'all',
      tagId: typeof raw.tagId === 'number' ? raw.tagId : 'all',
      completion:
        raw.completion === 'incomplete' || raw.completion === 'completed'
          ? raw.completion
          : 'all',
      dueDateFrom: typeof raw.dueDateFrom === 'string' ? raw.dueDateFrom : null,
      dueDateTo: typeof raw.dueDateTo === 'string' ? raw.dueDateTo : null,
    },
  };
}

export function loadPresets(): FilterPreset[] {
  if (!isBrowser()) return [];
  try {
    const raw = window.localStorage.getItem(PRESETS_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map(coercePreset)
      .filter((preset): preset is FilterPreset => preset !== null);
  } catch (error) {
    console.error('Failed to load filter presets:', error);
    return [];
  }
}

function writePresets(presets: FilterPreset[]): void {
  try {
    window.localStorage.setItem(PRESETS_KEY, JSON.stringify(presets));
  } catch (error) {
    console.error('Failed to write filter presets:', error);
    throw new PresetStorageError('Could not save preset — storage full');
  }
}

/** @throws {PresetStorageError} when `localStorage` rejects the write (quota exceeded). */
export function savePreset(name: string, filters: FilterState): FilterPreset[] {
  if (!isBrowser()) return [];
  const preset: FilterPreset = {
    id: createPresetId(),
    name,
    filters: { ...filters },
    createdAt: toSingaporeTimestamp(),
  };
  const presets = [...loadPresets(), preset];
  writePresets(presets);
  return presets;
}

export function deletePreset(id: string): FilterPreset[] {
  if (!isBrowser()) return [];
  const presets = loadPresets().filter((preset) => preset.id !== id);
  writePresets(presets);
  return presets;
}

function createPresetId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `preset-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}
