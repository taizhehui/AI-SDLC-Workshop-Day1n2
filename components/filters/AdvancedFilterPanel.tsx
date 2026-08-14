'use client';

import { SavedPresetPill } from './SavedPresetPill';
import type { FilterState } from '@/lib/filters';
import type { FilterPreset } from '@/lib/filter-presets';

const INPUT_CLASS =
  'rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white';

interface AdvancedFilterPanelProps {
  filters: FilterState;
  presets: FilterPreset[];
  onFilterChange: <K extends keyof FilterState>(key: K, value: FilterState[K]) => void;
  onApplyPreset: (preset: FilterPreset) => void;
  onDeletePreset: (id: string) => void;
}

/** Completion status, due-date range, and saved presets (PRP 08). */
export function AdvancedFilterPanel({
  filters,
  presets,
  onFilterChange,
  onApplyPreset,
  onDeletePreset,
}: AdvancedFilterPanelProps) {
  const invalidRange =
    filters.dueDateFrom !== null &&
    filters.dueDateTo !== null &&
    filters.dueDateFrom > filters.dueDateTo;

  return (
    <div
      data-testid="advanced-panel"
      className="space-y-3 rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-800/60"
    >
      <div className="flex flex-wrap gap-3">
        <label className="flex flex-col gap-1 text-sm text-gray-700 dark:text-gray-300">
          Completion status
          <select
            value={filters.completion}
            onChange={(event) =>
              onFilterChange('completion', event.target.value as FilterState['completion'])
            }
            data-testid="completion-filter"
            className={INPUT_CLASS}
          >
            <option value="all">All Todos</option>
            <option value="incomplete">Incomplete Only</option>
            <option value="completed">Completed Only</option>
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm text-gray-700 dark:text-gray-300">
          Due date from
          <input
            type="date"
            value={filters.dueDateFrom ?? ''}
            onChange={(event) => onFilterChange('dueDateFrom', event.target.value || null)}
            data-testid="date-from-filter"
            className={INPUT_CLASS}
          />
        </label>

        <label className="flex flex-col gap-1 text-sm text-gray-700 dark:text-gray-300">
          Due date to
          <input
            type="date"
            value={filters.dueDateTo ?? ''}
            onChange={(event) => onFilterChange('dueDateTo', event.target.value || null)}
            data-testid="date-to-filter"
            className={INPUT_CLASS}
          />
        </label>
      </div>

      {/* An inverted range is a hint, not a block — it simply matches nothing. */}
      {invalidRange && (
        <p className="text-xs text-amber-600 dark:text-amber-400">
          From date is after To date, so nothing will match.
        </p>
      )}

      {presets.length > 0 && (
        <div className="space-y-1 border-t border-gray-200 pt-3 dark:border-gray-700">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
            Saved filters
          </p>
          <div className="flex flex-wrap gap-2">
            {presets.map((preset) => (
              <SavedPresetPill
                key={preset.id}
                preset={preset}
                onApply={onApplyPreset}
                onDelete={onDeletePreset}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
