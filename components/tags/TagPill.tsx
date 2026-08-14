'use client';

import type { Tag } from '@/lib/db/types';

interface TagPillProps {
  tag: Tag;
  selected?: boolean;
  onClick?: (tag: Tag) => void;
  title?: string;
}

/**
 * Tag chip (PRP 06).
 *
 * When selected the pill takes the tag's own colour with white text; long names truncate so
 * a verbose tag cannot break the row layout.
 */
export function TagPill({ tag, selected = false, onClick, title }: TagPillProps) {
  const interactive = Boolean(onClick);

  return (
    <button
      type="button"
      title={title ?? tag.name}
      aria-pressed={interactive ? selected : undefined}
      onClick={() => onClick?.(tag)}
      disabled={!interactive}
      data-testid={`tag-pill-${tag.id}`}
      data-tag-name={tag.name}
      style={selected ? { backgroundColor: tag.color } : undefined}
      className={`inline-flex max-w-full items-center gap-1 rounded-full border px-3 py-1 text-sm font-medium transition-colors ${
        selected
          ? 'border-transparent text-white'
          : 'border-gray-300 bg-white text-gray-700 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200'
      } ${interactive ? 'cursor-pointer hover:opacity-90' : 'cursor-default'}`}
    >
      {selected && <span aria-hidden>✓</span>}
      <span className="max-w-[10rem] truncate">{tag.name}</span>
    </button>
  );
}
