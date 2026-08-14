'use client';

import { TagPill } from './TagPill';
import type { Tag } from '@/lib/db/types';

interface TagSelectorProps {
  tags: Tag[];
  selectedIds: number[];
  onToggle: (tagId: number) => void;
  onManage?: () => void;
}

/** Multi-select tag row used by both the create form and the edit modal (PRP 06). */
export function TagSelector({ tags, selectedIds, onToggle, onManage }: TagSelectorProps) {
  return (
    <div className="flex flex-wrap items-center gap-2" data-testid="tag-selector">
      {tags.map((tag) => (
        <TagPill
          key={tag.id}
          tag={tag}
          selected={selectedIds.includes(tag.id)}
          onClick={() => onToggle(tag.id)}
        />
      ))}

      {tags.length === 0 && (
        <span className="text-sm text-gray-500 dark:text-gray-400">No tags yet.</span>
      )}

      {onManage && (
        <button
          type="button"
          onClick={onManage}
          data-testid="manage-tags-button"
          className="rounded-full border border-dashed border-gray-400 px-3 py-1 text-sm text-gray-600 hover:border-blue-500 hover:text-blue-600 dark:border-gray-500 dark:text-gray-300 dark:hover:text-blue-400"
        >
          + Manage Tags
        </button>
      )}
    </div>
  );
}
