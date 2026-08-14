import type { TemplateSubtask } from './db/types';

/**
 * `subtasks_json` (de)serialization for templates (PRP 07).
 *
 * Kept in its own dependency-free module so client components can parse a template's
 * checklist without pulling the `better-sqlite3` data layer into the browser bundle.
 */

/** Serialize a subtask list, re-normalizing positions to array order. */
export function serializeTemplateSubtasks(
  subtasks: TemplateSubtask[] | undefined,
): string | null {
  if (!subtasks?.length) return null;
  return JSON.stringify(
    subtasks.map((subtask, index) => ({ title: subtask.title, position: index })),
  );
}

/**
 * Deserialize `subtasks_json`, falling back to an empty list.
 *
 * A corrupted or hand-edited row must never fail a "use template" request — the todo is still
 * created, just without a checklist.
 */
export function parseTemplateSubtasks(json: string | null): TemplateSubtask[] {
  if (!json) return [];

  try {
    const parsed: unknown = JSON.parse(json);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter(
        (entry): entry is { title: unknown; position?: unknown } =>
          typeof entry === 'object' && entry !== null && 'title' in entry,
      )
      .filter((entry) => typeof entry.title === 'string' && entry.title.trim() !== '')
      .map((entry, index) => ({
        title: String(entry.title),
        position: typeof entry.position === 'number' ? entry.position : index,
      }))
      .sort((a, b) => a.position - b.position);
  } catch (error) {
    console.error('Failed to parse template subtasks_json:', error);
    return [];
  }
}
