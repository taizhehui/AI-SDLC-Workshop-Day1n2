'use client';

import { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Banner } from '@/components/ui/Banner';
import { TagPill } from './TagPill';
import { DEFAULT_TAG_COLOR, type CreateTagInput, type Tag, type UpdateTagInput } from '@/lib/db/types';

interface ManageTagsModalProps {
  tags: Tag[];
  error: string | null;
  onClose: () => void;
  onCreate: (input: CreateTagInput) => Promise<Tag | null>;
  onUpdate: (id: number, input: UpdateTagInput) => Promise<Tag | null>;
  onDelete: (id: number) => Promise<boolean>;
}

/** Central create/edit/delete surface for the user's tags (PRP 06). */
export function ManageTagsModal({
  tags,
  error,
  onClose,
  onCreate,
  onUpdate,
  onDelete,
}: ManageTagsModalProps) {
  const [name, setName] = useState('');
  const [color, setColor] = useState(DEFAULT_TAG_COLOR);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState(DEFAULT_TAG_COLOR);

  const handleCreate = async () => {
    if (!name.trim()) return;
    const created = await onCreate({ name: name.trim(), color });
    if (created) {
      setName('');
      setColor(DEFAULT_TAG_COLOR);
    }
  };

  const startEditing = (tag: Tag) => {
    setEditingId(tag.id);
    setEditName(tag.name);
    setEditColor(tag.color);
  };

  const handleUpdate = async () => {
    if (editingId === null || !editName.trim()) return;
    const updated = await onUpdate(editingId, { name: editName.trim(), color: editColor });
    if (updated) setEditingId(null);
  };

  const handleDelete = async (tag: Tag) => {
    // Tag deletion cascades to every todo carrying it, so it gets an explicit confirmation
    // even though todo/subtask deletes intentionally do not.
    if (!window.confirm(`Delete the tag "${tag.name}"? It will be removed from all todos.`)) {
      return;
    }
    await onDelete(tag.id);
  };

  return (
    <Modal title="Manage Tags" onClose={onClose} testId="manage-tags-modal">
      <div className="space-y-4">
        {error && <Banner tone="error">{error}</Banner>}

        <ul className="max-h-64 space-y-2 overflow-y-auto">
          {tags.map((tag) => (
            <li key={tag.id} className="flex items-center justify-between gap-2">
              {editingId === tag.id ? (
                <div className="flex flex-1 items-center gap-2">
                  <input
                    value={editName}
                    onChange={(event) => setEditName(event.target.value)}
                    aria-label={`Rename tag ${tag.name}`}
                    className="min-w-0 flex-1 rounded border border-gray-300 px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                  />
                  <input
                    type="color"
                    value={editColor}
                    onChange={(event) => setEditColor(event.target.value)}
                    aria-label={`Colour for tag ${tag.name}`}
                    className="h-8 w-10 cursor-pointer rounded border border-gray-300 dark:border-gray-600"
                  />
                  <button
                    type="button"
                    onClick={handleUpdate}
                    className="text-sm font-medium text-blue-600 dark:text-blue-400"
                  >
                    Update
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingId(null)}
                    className="text-sm text-gray-500 dark:text-gray-400"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <>
                  <TagPill tag={tag} selected />
                  <div className="flex shrink-0 gap-2 text-sm">
                    <button
                      type="button"
                      onClick={() => startEditing(tag)}
                      className="text-blue-600 dark:text-blue-400"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(tag)}
                      className="text-red-600 dark:text-red-400"
                    >
                      Delete
                    </button>
                  </div>
                </>
              )}
            </li>
          ))}

          {tags.length === 0 && (
            <li className="text-sm text-gray-500 dark:text-gray-400">
              You have no tags yet. Create your first one below.
            </li>
          )}
        </ul>

        <div className="flex gap-2 border-t border-gray-200 pt-4 dark:border-gray-700">
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') void handleCreate();
            }}
            placeholder="Tag name"
            aria-label="New tag name"
            data-testid="new-tag-name"
            className="min-w-0 flex-1 rounded border border-gray-300 px-2 py-1 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
          />
          <input
            type="color"
            value={color}
            onChange={(event) => setColor(event.target.value)}
            aria-label="New tag colour"
            data-testid="new-tag-color"
            className="h-9 w-12 cursor-pointer rounded border border-gray-300 dark:border-gray-600"
          />
          <button
            type="button"
            onClick={handleCreate}
            disabled={!name.trim()}
            data-testid="create-tag-button"
            className="rounded bg-blue-600 px-3 py-1 text-white hover:bg-blue-700 disabled:opacity-50"
          >
            Create Tag
          </button>
        </div>
      </div>
    </Modal>
  );
}
