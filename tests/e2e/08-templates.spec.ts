import { expect, test } from '@playwright/test';
import {
  createTodo,
  dueDateInMinutes,
  installVirtualAuthenticator,
  registerAndLogin,
  todoByTitle,
} from './helpers';

/** PRP 07 — Template system. */
test.describe('Templates', () => {
  test.beforeEach(async ({ page }) => {
    await installVirtualAuthenticator(page);
    await registerAndLogin(page);
  });

  /** Fill the form, open the save-template modal, and store the pattern. */
  async function saveTemplate(
    page: import('@playwright/test').Page,
    options: {
      title: string;
      name: string;
      category?: string;
      priority?: 'high' | 'medium' | 'low';
      offsetMinutes?: number;
      recurrence?: 'daily' | 'weekly' | 'monthly' | 'yearly';
    },
  ) {
    await page.getByTestId('todo-title-input').fill(options.title);
    if (options.priority) {
      await page.getByTestId('create-priority').selectOption(options.priority);
    }
    if (options.recurrence) {
      await page.getByTestId('create-due-date').fill(dueDateInMinutes(120));
      await page.getByTestId('create-repeat').check();
      await page.getByTestId('create-pattern').selectOption(options.recurrence);
    }

    await page.getByTestId('save-as-template-button').click();
    await page.getByTestId('template-name-input').fill(options.name);
    if (options.category) {
      await page.getByTestId('template-category-input').fill(options.category);
    }
    if (options.offsetMinutes !== undefined) {
      await page.getByTestId('template-offset-input').fill(String(options.offsetMinutes));
    }
    await page.getByTestId('save-template-button').click();
    await expect(page.getByTestId('save-template-modal')).toHaveCount(0);
  }

  test('saves a template and lists it in both the dropdown and the manager', async ({ page }) => {
    await saveTemplate(page, {
      title: 'Weekly team meeting',
      name: 'Team Meeting',
      category: 'Work',
      priority: 'high',
    });

    await expect(page.getByTestId('template-picker')).toContainText('Team Meeting (Work)');

    await page.getByTestId('open-templates-button').click();
    await expect(page.getByTestId('template-manager-modal')).toContainText('Team Meeting');
    await expect(page.getByTestId('template-manager-modal')).toContainText('Work');
  });

  test('the quick dropdown creates a todo in one action', async ({ page }) => {
    await saveTemplate(page, {
      title: 'Weekly team meeting',
      name: 'Team Meeting',
      priority: 'high',
    });

    await page.getByTestId('template-picker').selectOption({ label: 'Team Meeting' });

    await expect(todoByTitle(page, 'Weekly team meeting')).toBeVisible();
    await expect(
      todoByTitle(page, 'Weekly team meeting').getByTestId('priority-badge-high'),
    ).toBeVisible();
  });

  test('using a template from the manager closes the modal', async ({ page }) => {
    await saveTemplate(page, { title: 'Client onboarding', name: 'Onboarding' });

    await page.getByTestId('open-templates-button').click();
    await page.getByRole('button', { name: 'Use' }).first().click();

    await expect(page.getByTestId('template-manager-modal')).toHaveCount(0);
    await expect(todoByTitle(page, 'Client onboarding')).toBeVisible();
  });

  test('a due-date offset resolves at use time', async ({ page }) => {
    await saveTemplate(page, {
      title: 'Follow up tomorrow',
      name: 'Follow Up',
      offsetMinutes: 1440,
    });

    await page.getByTestId('template-picker').selectOption({ label: 'Follow Up' });
    await expect(todoByTitle(page, 'Follow up tomorrow')).toBeVisible();

    const dueDate = await page.evaluate(async () => {
      const todos = await fetch('/api/todos').then((r) => r.json());
      return todos.find((todo: { title: string }) => todo.title === 'Follow up tomorrow')
        .due_date as string;
    });

    // One day out from "now", to the minute.
    const expected = new Date(Date.now() + 1440 * 60_000);
    const diffMinutes = Math.abs(
      (new Date(`${dueDate}+08:00`).getTime() - expected.getTime()) / 60_000,
    );
    expect(diffMinutes).toBeLessThan(2);
  });

  test('recreates the template checklist on every use', async ({ page }) => {
    const todo = await page.evaluate(async () => {
      const template = await fetch('/api/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Checklist Template',
          title_template: 'Onboard new client',
          priority: 'medium',
          subtasks: [
            { title: 'Send welcome email' },
            { title: 'Schedule kickoff call' },
          ],
        }),
      }).then((r) => r.json());

      return fetch(`/api/templates/${template.id}/use`, { method: 'POST' }).then((r) => r.json());
    });

    expect(todo.subtasks.map((s: { title: string }) => s.title)).toEqual([
      'Send welcome email',
      'Schedule kickoff call',
    ]);
    expect(todo.subtasks.every((s: { completed: boolean }) => !s.completed)).toBe(true);
  });

  test('a template with no subtasks creates a todo with none', async ({ page }) => {
    await saveTemplate(page, { title: 'Simple task', name: 'Simple' });
    await page.getByTestId('template-picker').selectOption({ label: 'Simple' });

    const subtasks = await page.evaluate(async () => {
      const todos = await fetch('/api/todos').then((r) => r.json());
      return todos.find((todo: { title: string }) => todo.title === 'Simple task').subtasks;
    });

    expect(subtasks).toEqual([]);
  });

  test('never carries tags onto the created todo', async ({ page }) => {
    await page.getByTestId('manage-tags-button').click();
    await page.getByTestId('new-tag-name').fill('Work');
    await page.getByTestId('create-tag-button').click();
    await page.getByTestId('manage-tags-modal').getByLabel('Close').click();

    await page.getByTestId('todo-title-input').fill('Tagged draft');
    await page.getByTestId('tag-selector').locator('[data-tag-name="Work"]').click();

    await page.getByTestId('save-as-template-button').click();
    await page.getByTestId('template-name-input').fill('Untagged Template');
    await page.getByTestId('save-template-button').click();

    await page.getByTestId('template-picker').selectOption({ label: 'Untagged Template' });

    const tags = await page.evaluate(async () => {
      const todos = await fetch('/api/todos').then((r) => r.json());
      return todos.find((todo: { title: string }) => todo.title === 'Tagged draft').tags;
    });

    expect(tags).toEqual([]);
  });

  test('deleting a template leaves todos created from it untouched', async ({ page }) => {
    await saveTemplate(page, { title: 'Durable todo', name: 'Durable' });
    await page.getByTestId('template-picker').selectOption({ label: 'Durable' });
    await expect(todoByTitle(page, 'Durable todo')).toBeVisible();

    page.once('dialog', (dialog) => void dialog.accept());
    await page.getByTestId('open-templates-button').click();
    await page.getByRole('button', { name: 'Delete' }).first().click();
    await page.getByTestId('template-manager-modal').getByLabel('Close').click();

    await expect(page.getByTestId('template-picker')).toHaveCount(0);
    await page.reload();
    await expect(todoByTitle(page, 'Durable todo')).toBeVisible();
  });

  test('rejects a recurring template without a due-date offset', async ({ page }) => {
    const status = await page.evaluate(async () => {
      const response = await fetch('/api/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Invalid recurring',
          title_template: 'Repeats forever',
          priority: 'medium',
          is_recurring: true,
          recurrence_pattern: 'weekly',
        }),
      });
      return response.status;
    });

    expect(status).toBe(400);
  });

  test('creates a todo from a template while also using the todo form', async ({ page }) => {
    await createTodo(page, 'Manually created');
    await saveTemplate(page, { title: 'From template', name: 'Coexist' });
    await page.getByTestId('template-picker').selectOption({ label: 'Coexist' });

    await expect(todoByTitle(page, 'Manually created')).toBeVisible();
    await expect(todoByTitle(page, 'From template')).toBeVisible();
  });
});
