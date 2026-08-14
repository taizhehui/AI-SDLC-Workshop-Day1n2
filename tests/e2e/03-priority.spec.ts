import { expect, test } from '@playwright/test';
import {
  createTodo,
  dueDateInMinutes,
  installVirtualAuthenticator,
  registerAndLogin,
  todoByTitle,
  todoId,
} from './helpers';

/** PRP 02 — Priority system. */
test.describe('Priority system', () => {
  test.beforeEach(async ({ page }) => {
    await installVirtualAuthenticator(page);
    await registerAndLogin(page);
  });

  test('renders the correct badge for each priority level', async ({ page }) => {
    await createTodo(page, 'High task', { priority: 'high' });
    await createTodo(page, 'Medium task', { priority: 'medium' });
    await createTodo(page, 'Low task', { priority: 'low' });

    await expect(todoByTitle(page, 'High task').getByTestId('priority-badge-high')).toHaveText(
      'High',
    );
    await expect(
      todoByTitle(page, 'Medium task').getByTestId('priority-badge-medium'),
    ).toHaveText('Medium');
    await expect(todoByTitle(page, 'Low task').getByTestId('priority-badge-low')).toHaveText(
      'Low',
    );
  });

  test('defaults an unspecified priority to Medium', async ({ page }) => {
    await createTodo(page, 'Default priority task');
    await expect(
      todoByTitle(page, 'Default priority task').getByTestId('priority-badge-medium'),
    ).toBeVisible();
  });

  test('orders three same-due-date todos High then Medium then Low', async ({ page }) => {
    const due = dueDateInMinutes(180);
    await createTodo(page, 'C low', { priority: 'low', dueDate: due });
    await createTodo(page, 'A high', { priority: 'high', dueDate: due });
    await createTodo(page, 'B medium', { priority: 'medium', dueDate: due });

    const titles = await page
      .getByTestId('section-pending')
      .locator('[data-todo-title]')
      .evaluateAll((nodes) => nodes.map((node) => node.getAttribute('data-todo-title')));

    expect(titles).toEqual(['A high', 'B medium', 'C low']);
  });

  test('raising priority moves the todo above lower-priority siblings', async ({ page }) => {
    await createTodo(page, 'Promote me', { priority: 'low' });
    await createTodo(page, 'Stays medium', { priority: 'medium' });

    const id = await todoId(page, 'Promote me');
    await page.getByTestId(`todo-edit-${id}`).click();
    await page.getByTestId('edit-priority').selectOption('high');
    await page.getByTestId('update-todo-button').click();
    await expect(page.getByTestId('todo-edit-modal')).toHaveCount(0);

    const titles = await page
      .getByTestId('section-pending')
      .locator('[data-todo-title]')
      .evaluateAll((nodes) => nodes.map((node) => node.getAttribute('data-todo-title')));

    expect(titles[0]).toBe('Promote me');
  });

  test('the priority filter narrows the list and clears again', async ({ page }) => {
    await createTodo(page, 'Urgent thing', { priority: 'high' });
    await createTodo(page, 'Casual thing', { priority: 'low' });

    await page.getByTestId('priority-filter').selectOption('high');
    await expect(todoByTitle(page, 'Urgent thing')).toBeVisible();
    await expect(todoByTitle(page, 'Casual thing')).toHaveCount(0);

    await page.getByTestId('priority-filter').selectOption('all');
    await expect(todoByTitle(page, 'Casual thing')).toBeVisible();
  });

  test('rejects an invalid priority at the API layer', async ({ page }) => {
    const status = await page.evaluate(async () => {
      const response = await fetch('/api/todos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Bad priority', priority: 'urgent' }),
      });
      return response.status;
    });

    expect(status).toBe(400);
    await page.reload();
    await expect(todoByTitle(page, 'Bad priority')).toHaveCount(0);
  });
});
