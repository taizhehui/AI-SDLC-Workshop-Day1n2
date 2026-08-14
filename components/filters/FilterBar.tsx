'use client';

import { useState } from 'react';
import { SearchBar } from './SearchBar';
import { AdvancedFilterPanel } from './AdvancedFilterPanel';
import { Banner } from '@/components/ui/Banner';
import type { FilterState } from '@/lib/filters';
import type { FilterPreset } from '@/lib/filter-presets';
import type { Priority, Tag } from '@/lib/db/types';

const SELECT_CLASS =
  'rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white';

interface FilterBarProps {
  filters: FilterState;
  tags: Tag[];
  presets: FilterPreset[];
  presetError: string | null;
  isFiltered: boolean;
  onFilterChange: <K extends keyof FilterState>(key: K, value: FilterState[K]) => void;
  onClearAll: () => void;
  onSaveFilter: () => void;
  onApplyPreset: (preset: FilterPreset) => void;
  onDeletePreset: (id: string) => void;
}

/** Search, quick filters, and the advanced panel toggle (PRP 08). */
export function FilterBar({
  filters,
  tags,
  presets,
  presetError,
  isFiltered,
  onFilterChange,
  onClearAll,
  onSaveFilter,
  onApplyPreset,
  onDeletePreset,
}: FilterBarProps) {
  const [advancedOpen, setAdvancedOpen] = useState(false);

  return (
    <div className="space-y-3 rounded-xl bg-white p-4 shadow-sm dark:bg-gray-800">
      <div className="flex flex-wrap items-center gap-2">
        <SearchBar value={filters.search} onChange={(value) => onFilterChange('search', value)} />

        <select
          value={filters.priority}
          onChange={(event) =>
            onFilterChange('priority', event.target.value as Priority | 'all')
          }
          aria-label="Filter by priority"
          data-testid="priority-filter"
          className={SELECT_CLASS}
        >
          <option value="all">All Priorities</option>
          <option value="high">High Priority</option>
          <option value="medium">Medium Priority</option>
          <option value="low">Low Priority</option>
        </select>

        {tags.length > 0 && (
          <select
            value={filters.tagId === 'all' ? 'all' : String(filters.tagId)}
            onChange={(event) =>
              onFilterChange(
                'tagId',
                event.target.value === 'all' ? 'all' : Number(event.target.value),
              )
            }
            aria-label="Filter by tag"
            data-testid="tag-filter"
            className={SELECT_CLASS}
          >
            <option value="all">All Tags</option>
            {tags.map((tag) => (
              <option key={tag.id} value={tag.id}>
                {tag.name}
              </option>
            ))}
          </select>
        )}

        <button
          type="button"
          onClick={() => setAdvancedOpen((prev) => !prev)}
          aria-expanded={advancedOpen}
          data-testid="advanced-toggle"
          className={`rounded-lg px-3 py-2 text-sm font-medium ${
            advancedOpen
              ? 'bg-blue-500 text-white'
              : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200'
          }`}
        >
          {advancedOpen ? '▼ Advanced' : '▶ Advanced'}
        </button>

        {/* Only meaningful once something is actually filtered. */}
        {isFiltered && (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClearAll}
              data-testid="clear-all-filters"
              className="text-sm font-medium text-red-600 hover:underline dark:text-red-400"
            >
              Clear All
            </button>
            <button
              type="button"
              onClick={onSaveFilter}
              data-testid="save-filter-button"
              className="text-sm font-medium text-green-600 hover:underline dark:text-green-400"
            >
              💾 Save Filter
            </button>
          </div>
        )}
      </div>

      {advancedOpen && (
        <AdvancedFilterPanel
          filters={filters}
          presets={presets}
          onFilterChange={onFilterChange}
          onApplyPreset={onApplyPreset}
          onDeletePreset={onDeletePreset}
        />
      )}

      {presetError && <Banner tone="error">{presetError}</Banner>}
    </div>
  );
}
