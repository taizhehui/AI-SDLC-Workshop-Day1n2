'use client';

import { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { describeFilters, type FilterState } from '@/lib/filters';
import type { Tag } from '@/lib/db/types';

interface SaveFilterModalProps {
  filters: FilterState;
  tags: Tag[];
  onClose: () => void;
  onSave: (name: string) => boolean;
}

/** Name and store the current filter combination, with a preview of what will be saved. */
export function SaveFilterModal({ filters, tags, onClose, onSave }: SaveFilterModalProps) {
  const [name, setName] = useState('');

  const summary = describeFilters(
    filters,
    (id) => tags.find((tag) => tag.id === id)?.name,
  );

  const handleSave = () => {
    if (!name.trim()) return;
    if (onSave(name.trim())) onClose();
  };

  return (
    <Modal title="Save Filter" onClose={onClose} maxWidth="max-w-md" testId="save-filter-modal">
      <div className="space-y-4">
        <div className="rounded-lg bg-gray-50 p-3 text-sm text-gray-600 dark:bg-gray-700/50 dark:text-gray-300">
          <p className="mb-1 font-medium">Active filters</p>
          <p data-testid="filter-preview">{summary.join(' · ') || 'None'}</p>
        </div>

        <label className="flex flex-col gap-1 text-sm text-gray-700 dark:text-gray-300">
          Preset name
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') handleSave();
            }}
            placeholder="e.g. Today's High Priority"
            data-testid="preset-name-input"
            className="rounded-md border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
          />
        </label>

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!name.trim()}
            data-testid="save-preset-button"
            className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
          >
            Save
          </button>
        </div>
      </div>
    </Modal>
  );
}
