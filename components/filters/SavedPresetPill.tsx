'use client';

import type { FilterPreset } from '@/lib/filter-presets';

interface SavedPresetPillProps {
  preset: FilterPreset;
  onApply: (preset: FilterPreset) => void;
  onDelete: (id: string) => void;
}

/** One saved filter combination, applied or removed in a click (PRP 08). */
export function SavedPresetPill({ preset, onApply, onDelete }: SavedPresetPillProps) {
  const handleDelete = () => {
    if (!window.confirm(`Delete the saved filter "${preset.name}"?`)) return;
    onDelete(preset.id);
  };

  return (
    <span
      data-testid={`preset-pill-${preset.id}`}
      className="inline-flex items-center gap-1 rounded-full border border-gray-300 px-3 py-1 text-sm dark:border-gray-600"
    >
      <button
        type="button"
        onClick={() => onApply(preset)}
        className="font-medium text-gray-700 hover:text-blue-600 dark:text-gray-200 dark:hover:text-blue-400"
      >
        {preset.name}
      </button>
      <button
        type="button"
        onClick={handleDelete}
        aria-label={`Delete preset ${preset.name}`}
        className="text-gray-400 hover:text-red-500"
      >
        ✕
      </button>
    </span>
  );
}
