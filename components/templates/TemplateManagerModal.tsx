'use client';

import { Modal } from '@/components/ui/Modal';
import { Banner } from '@/components/ui/Banner';
import { TemplateCard } from './TemplateCard';
import type { Template } from '@/lib/db/types';

interface TemplateManagerModalProps {
  templates: Template[];
  error: string | null;
  onClose: () => void;
  onUse: (id: number) => void;
  onDelete: (id: number) => void;
}

/** Full template library: browse, use, and delete (PRP 07). */
export function TemplateManagerModal({
  templates,
  error,
  onClose,
  onUse,
  onDelete,
}: TemplateManagerModalProps) {
  return (
    <Modal title="Templates" onClose={onClose} testId="template-manager-modal">
      <div className="space-y-3">
        {error && <Banner tone="error">{error}</Banner>}

        {templates.length === 0 ? (
          <p className="py-6 text-center text-sm text-gray-500 dark:text-gray-400">
            No templates yet. Fill in the todo form and choose “💾 Save as Template”.
          </p>
        ) : (
          <div className="max-h-96 space-y-2 overflow-y-auto">
            {templates.map((template) => (
              <TemplateCard
                key={template.id}
                template={template}
                // Using a template closes the manager so the new todo is visible right away.
                onUse={(id) => {
                  onUse(id);
                  onClose();
                }}
                onDelete={onDelete}
              />
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}
