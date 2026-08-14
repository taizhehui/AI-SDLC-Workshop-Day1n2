'use client';

import { useState } from 'react';
import { AppHeader } from '@/components/layout/AppHeader';
import { NotificationToggle } from '@/components/layout/NotificationToggle';
import { ExportImportToolbar } from '@/components/layout/ExportImportToolbar';
import { TodoForm } from '@/components/todos/TodoForm';
import { TodoList } from '@/components/todos/TodoList';
import { TodoEditModal } from '@/components/todos/TodoEditModal';
import { FilterBar } from '@/components/filters/FilterBar';
import { SaveFilterModal } from '@/components/filters/SaveFilterModal';
import { ManageTagsModal } from '@/components/tags/ManageTagsModal';
import { SaveTemplateModal } from '@/components/templates/SaveTemplateModal';
import { TemplateManagerModal } from '@/components/templates/TemplateManagerModal';
import { Banner } from '@/components/ui/Banner';
import { useTodos } from '@/lib/hooks/useTodos';
import { useTags } from '@/lib/hooks/useTags';
import { useTemplates } from '@/lib/hooks/useTemplates';
import { useFilters } from '@/lib/hooks/useFilters';
import { useNotifications } from '@/lib/hooks/useNotifications';
import type { TodoDraft } from '@/lib/hooks/useTodoForm';
import type { Tag, Todo } from '@/lib/db/types';

type ActiveModal =
  | { kind: 'none' }
  | { kind: 'edit'; todo: Todo }
  | { kind: 'tags' }
  | { kind: 'save-template'; draft: TodoDraft }
  | { kind: 'templates' }
  | { kind: 'save-filter' };

/**
 * Main todo page.
 *
 * Composition only: each feature owns its own hook (state + API calls) and its own component
 * tree, so this file stays a wiring layer rather than accumulating feature logic.
 */
export default function HomePage() {
  const todosState = useTodos();
  const tagsState = useTags();
  const templatesState = useTemplates();
  const filtersState = useFilters(todosState.todos, tagsState.tags);
  const notifications = useNotifications();

  const [modal, setModal] = useState<ActiveModal>({ kind: 'none' });
  const closeModal = () => setModal({ kind: 'none' });

  const handleUseTemplate = async (templateId: number) => {
    const created = await templatesState.useTemplate(templateId);
    if (created) todosState.addTodoLocally(created);
  };

  const handleTagClick = (tag: Tag) => {
    filtersState.updateFilter('tagId', tag.id);
  };

  return (
    <main className="mx-auto max-w-4xl space-y-6 p-4 sm:p-6">
      <AppHeader current="list">
        <NotificationToggle
          granted={notifications.granted}
          supported={notifications.supported}
          onRequest={() => void notifications.requestPermission()}
        />
        <button
          type="button"
          onClick={() => setModal({ kind: 'templates' })}
          data-testid="open-templates-button"
          className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700"
        >
          📋 Templates
        </button>
      </AppHeader>

      <ExportImportToolbar
        onImported={() => {
          void todosState.refresh();
          void tagsState.refresh();
        }}
      />

      {todosState.error && (
        <Banner tone="error" testId="todos-error" onDismiss={() => todosState.setError(null)}>
          {todosState.error}
        </Banner>
      )}

      <TodoForm
        tags={tagsState.tags}
        templates={templatesState.templates}
        onCreate={todosState.createTodo}
        onManageTags={() => setModal({ kind: 'tags' })}
        onSaveAsTemplate={(draft) => setModal({ kind: 'save-template', draft })}
        onUseTemplate={(id) => void handleUseTemplate(id)}
      />

      <FilterBar
        filters={filtersState.filters}
        tags={tagsState.tags}
        presets={filtersState.presets}
        presetError={filtersState.presetError}
        isFiltered={filtersState.isFiltered}
        onFilterChange={filtersState.updateFilter}
        onClearAll={filtersState.clearAll}
        onSaveFilter={() => setModal({ kind: 'save-filter' })}
        onApplyPreset={filtersState.applyPreset}
        onDeletePreset={filtersState.removePreset}
      />

      <TodoList
        todos={filtersState.filteredTodos}
        hasAnyTodos={todosState.todos.length > 0}
        isFiltered={filtersState.isFiltered}
        loading={todosState.loading}
        onToggle={(id, completed) => void todosState.toggleTodo(id, completed)}
        onEdit={(todo) => setModal({ kind: 'edit', todo })}
        onDelete={(id) => void todosState.deleteTodo(id)}
        onSubtasksChange={todosState.replaceSubtasks}
        onTagClick={handleTagClick}
      />

      {modal.kind === 'edit' && (
        <TodoEditModal
          todo={modal.todo}
          tags={tagsState.tags}
          onClose={closeModal}
          onSave={todosState.updateTodo}
        />
      )}

      {modal.kind === 'tags' && (
        <ManageTagsModal
          tags={tagsState.tags}
          error={tagsState.error}
          onClose={() => {
            tagsState.setError(null);
            closeModal();
          }}
          onCreate={tagsState.createTag}
          onUpdate={tagsState.updateTag}
          onDelete={async (id) => {
            const deleted = await tagsState.deleteTag(id);
            // Deleted tags may still be attached to todos in local state.
            if (deleted) void todosState.refresh();
            return deleted;
          }}
        />
      )}

      {modal.kind === 'save-template' && (
        <SaveTemplateModal
          draft={modal.draft}
          error={templatesState.error}
          onClose={() => {
            templatesState.setError(null);
            closeModal();
          }}
          onSave={templatesState.createTemplate}
        />
      )}

      {modal.kind === 'templates' && (
        <TemplateManagerModal
          templates={templatesState.templates}
          error={templatesState.error}
          onClose={closeModal}
          onUse={(id) => void handleUseTemplate(id)}
          onDelete={(id) => void templatesState.deleteTemplate(id)}
        />
      )}

      {modal.kind === 'save-filter' && (
        <SaveFilterModal
          filters={filtersState.filters}
          tags={tagsState.tags}
          onClose={closeModal}
          onSave={filtersState.saveCurrentAsPreset}
        />
      )}
    </main>
  );
}
