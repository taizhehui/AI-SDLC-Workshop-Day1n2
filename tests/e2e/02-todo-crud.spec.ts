import { expect, test } from '@playwright/test';
import {
  addSubtask,
  createTodo,
  dueDateInMinutes,
  installVirtualAuthenticator,
  registerAndLogin,
  todoByTitle,
  todoId,
} from './helpers';

/** PRP 01 — Todo CRUD operations. */
test.describe('Todo CRUD', () => {
  test.beforeEach(async ({ page }) => {
    await installVirtualAuthenticator(page);
    await registerAndLogin(page);
  });

  test('creates a todo with a title only and files it under Pending', async ({ page }) => {
    await createTodo(page, 'Title only todo');

    await expect(page.getByTestId('section-pending')).toContainText('Title only todo');
    // Unspecified priority defaults to medium.
    await expect(
      todoByTitle(page, 'Title only todo').getByTestId('priority-badge-medium'),
    ).toBeVisible();
  });

  test('creates a todo with priority and a future due date', async ({ page }) => {
    await createTodo(page, 'Planned todo', {
      priority: 'high',
      dueDate: dueDateInMinutes(120),
    });

    const todo = todoByTitle(page, 'Planned todo');
    await expect(todo.getByTestId('priority-badge-high')).toBeVisible();
    await expect(page.getByTestId('section-pending')).toContainText('Planned todo');
  });

  test('does not submit an empty title', async ({ page }) => {
    await expect(page.getByTestId('add-todo-button')).toBeDisabled();

    await page.getByTestId('todo-title-input').fill('   ');
    await expect(page.getByTestId('add-todo-button')).toBeDisabled();
  });

  test('rejects a due date in the past', async ({ page }) => {
    await page.getByTestId('todo-title-input').fill('Past due todo');
    await page.getByTestId('create-due-date').fill(dueDateInMinutes(-60));
    await page.getByTestId('add-todo-button').click();

    await expect(page.getByTestId('todo-form-error')).toContainText(
      'at least 1 minute in the future',
    );
    await expect(todoByTitle(page, 'Past due todo')).toHaveCount(0);
  });

  test('editing the title and priority re-sorts the list', async ({ page }) => {
    await createTodo(page, 'Low item', { priority: 'low' });
    await createTodo(page, 'Medium item', { priority: 'medium' });

    const id = await todoId(page, 'Low item');
    await page.getByTestId(`todo-edit-${id}`).click();
    await page.getByTestId('edit-title-input').fill('Now urgent');
    await page.getByTestId('edit-priority').selectOption('high');
    await page.getByTestId('update-todo-button').click();

    await expect(page.getByTestId('todo-edit-modal')).toHaveCount(0);
    await expect(todoByTitle(page, 'Now urgent')).toBeVisible();

    // High priority must sort above the untouched medium item.
    const titles = await page
      .getByTestId('section-pending')
      .locator('[data-todo-title]')
      .evaluateAll((nodes) => nodes.map((node) => node.getAttribute('data-todo-title')));
    expect(titles.indexOf('Now urgent')).toBeLessThan(titles.indexOf('Medium item'));
  });

  test('cancelling an edit discards the change', async ({ page }) => {
    await createTodo(page, 'Unchanged todo');

    const id = await todoId(page, 'Unchanged todo');
    await page.getByTestId(`todo-edit-${id}`).click();
    await page.getByTestId('edit-title-input').fill('Should not persist');
    await page.getByTestId('cancel-edit-button').click();

    await expect(page.getByTestId('todo-edit-modal')).toHaveCount(0);
    await expect(todoByTitle(page, 'Unchanged todo')).toBeVisible();
    await expect(todoByTitle(page, 'Should not persist')).toHaveCount(0);
  });

  test('pressing Escape closes the edit modal without saving', async ({ page }) => {
    await createTodo(page, 'Escape test todo');

    const id = await todoId(page, 'Escape test todo');
    await page.getByTestId(`todo-edit-${id}`).click();
    await page.getByTestId('edit-title-input').fill('Discarded');
    await page.keyboard.press('Escape');

    await expect(page.getByTestId('todo-edit-modal')).toHaveCount(0);
    await expect(todoByTitle(page, 'Escape test todo')).toBeVisible();
  });

  test('toggling completion moves the todo between sections', async ({ page }) => {
    await createTodo(page, 'Toggle me');
    const id = await todoId(page, 'Toggle me');

    await page.getByTestId(`todo-checkbox-${id}`).check();
    await expect(page.getByTestId('section-completed')).toContainText('Toggle me');

    await page.getByTestId(`todo-checkbox-${id}`).uncheck();
    await expect(page.getByTestId('section-pending')).toContainText('Toggle me');
  });

  test('deletes a todo immediately and it stays gone after a reload', async ({ page }) => {
    await createTodo(page, 'Delete me');
    const id = await todoId(page, 'Delete me');

    await page.getByTestId(`todo-delete-${id}`).click();
    await expect(todoByTitle(page, 'Delete me')).toHaveCount(0);

    await page.reload();
    await expect(todoByTitle(page, 'Delete me')).toHaveCount(0);
  });

  test('deleting a todo cascades to its subtasks', async ({ page }) => {
    await createTodo(page, 'Parent todo');
    await addSubtask(page, 'Parent todo', 'Child subtask');

    const id = await todoId(page, 'Parent todo');
    await page.getByTestId(`todo-delete-${id}`).click();
    await page.reload();

    await expect(todoByTitle(page, 'Parent todo')).toHaveCount(0);
    await expect(page.getByText('Child subtask')).toHaveCount(0);
  });

  test('shows the distinct empty state when the user has no todos', async ({ page }) => {
    await expect(page.getByTestId('empty-no-todos')).toBeVisible();
  });
});
