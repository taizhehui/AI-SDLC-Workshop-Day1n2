'use client';

import type { Template } from '@/lib/db/types';

interface TemplatePickerProps {
  templates: Template[];
  onUse: (templateId: number) => void;
}

/**
 * Quick "Use Template" dropdown inside the todo form (PRP 07).
 *
 * Selecting an entry creates the todo immediately — no confirmation step. The select resets
 * to its placeholder so the same template can be used twice in a row.
 */
export function TemplatePicker({ templates, onUse }: TemplatePickerProps) {
  if (templates.length === 0) return null;

  return (
    <select
      value=""
      onChange={(event) => {
        if (!event.target.value) return;
        onUse(Number(event.target.value));
        event.target.value = '';
      }}
      aria-label="Use template"
      data-testid="template-picker"
      className="rounded-md border border-gray-300 px-3 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
    >
      <option value="">Use Template…</option>
      {templates.map((template) => (
        <option key={template.id} value={template.id}>
          {template.category ? `${template.name} (${template.category})` : template.name}
        </option>
      ))}
    </select>
  );
}
