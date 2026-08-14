import { expect, test } from '@playwright/test';
import {
  addSubtask,
  createTag,
  createTodo,
  dueDateInMinutes,
  installVirtualAuthenticator,
  registerAndLogin,
  todoByTitle,
  todoId,
} from './helpers';

/** PRP 08 — Search & filtering. */
test.describe('Search and filtering', () => {
  test.beforeEach(async ({ page }) => {
    await installVirtualAuthenticator(page);
    await registerAndLogin(page);
  });

  test('searches todo titles case-insensitively', async ({ page }) => {
    await createTodo(page, 'Team meeting');
    await createTodo(page, 'Buy groceries');

    await page.getByTestId('search-input').fill('MEETING');

    await expect(todoByTitle(page, 'Team meeting')).toBeVisible();
    await expect(todoByTitle(page, 'Buy groceries')).toHaveCount(0);
  });

  test('searching a subtask title returns the parent todo', async ({ page }) => {
    await createTodo(page, 'Prepare presentation');
    await addSubtask(page, 'Prepare presentation', 'Rehearse speech');
    await createTodo(page, 'Unrelated todo');

    await page.getByTestId('search-input').fill('rehearse');

    await expect(todoByTitle(page, 'Prepare presentation')).toBeVisible();
    await expect(todoByTitle(page, 'Unrelated todo')).toHaveCount(0);
  });

  test('the ✕ button restores the full list immediately', async ({ page }) => {
    await createTodo(page, 'Team meeting');
    await createTodo(page, 'Buy groceries');

    await page.getByTestId('search-input').fill('meeting');
    await expect(todoByTitle(page, 'Buy groceries')).toHaveCount(0);

    await page.getByTestId('clear-search').click();
    await expect(todoByTitle(page, 'Buy groceries')).toBeVisible();
  });

  test('expanding Advanced reveals completion and date controls', async ({ page }) => {
    await expect(page.getByTestId('advanced-panel')).toHaveCount(0);

    await page.getByTestId('advanced-toggle').click();

    await expect(page.getByTestId('completion-filter')).toBeVisible();
    await expect(page.getByTestId('date-from-filter')).toBeVisible();
    await expect(page.getByTestId('date-to-filter')).toBeVisible();
  });

  test('the completion filter isolates completed and incomplete todos', async ({ page }) => {
    await createTodo(page, 'Finished task');
    await createTodo(page, 'Open task');

    const id = await todoId(page, 'Finished task');
    await page.getByTestId(`todo-checkbox-${id}`).check();
    await expect(page.getByTestId('section-completed')).toContainText('Finished task');

    await page.getByTestId('advanced-toggle').click();
    await page.getByTestId('completion-filter').selectOption('completed');
    await expect(todoByTitle(page, 'Finished task')).toBeVisible();
    await expect(todoByTitle(page, 'Open task')).toHaveCount(0);

    await page.getByTestId('completion-filter').selectOption('incomplete');
    await expect(todoByTitle(page, 'Open task')).toBeVisible();
    await expect(todoByTitle(page, 'Finished task')).toHaveCount(0);
  });

  test('the date range filter matches only todos due within it', async ({ page }) => {
    await createTodo(page, 'Due soon', { dueDate: dueDateInMinutes(120) });
    await createTodo(page, 'Due much later', { dueDate: '2031-12-01T09:00' });
    await createTodo(page, 'No due date');

    const today = dueDateInMinutes(0).slice(0, 10);
    await page.getByTestId('advanced-toggle').click();
    await page.getByTestId('date-from-filter').fill(today);
    await page.getByTestId('date-to-filter').fill('2031-01-01');

    await expect(todoByTitle(page, 'Due soon')).toBeVisible();
    await expect(todoByTitle(page, 'Due much later')).toHaveCount(0);
    // A todo with no due date can never satisfy a date range.
    await expect(todoByTitle(page, 'No due date')).toHaveCount(0);
  });

  test('combining every filter narrows to the AND intersection', async ({ page }) => {
    await createTag(page, 'Work');
    await createTodo(page, 'Important work meeting', {
      priority: 'high',
      dueDate: dueDateInMinutes(180),
      tagNames: ['Work'],
    });
    await createTodo(page, 'Important personal meeting', { priority: 'high' });
    await createTodo(page, 'Low priority work meeting', {
      priority: 'low',
      tagNames: ['Work'],
    });

    await page.getByTestId('search-input').fill('meeting');
    await page.getByTestId('priority-filter').selectOption('high');
    await page.getByTestId('tag-filter').selectOption({ label: 'Work' });
    await page.getByTestId('advanced-toggle').click();
    await page.getByTestId('completion-filter').selectOption('incomplete');

    await expect(todoByTitle(page, 'Important work meeting')).toBeVisible();
    await expect(todoByTitle(page, 'Important personal meeting')).toHaveCount(0);
    await expect(todoByTitle(page, 'Low priority work meeting')).toHaveCount(0);
  });

  test('Clear All appears only when filtered and resets every dimension', async ({ page }) => {
    await createTodo(page, 'Alpha todo');
    await createTodo(page, 'Beta todo');

    await expect(page.getByTestId('clear-all-filters')).toHaveCount(0);

    await page.getByTestId('search-input').fill('alpha');
    await page.getByTestId('priority-filter').selectOption('high');
    await expect(page.getByTestId('clear-all-filters')).toBeVisible();

    await page.getByTestId('clear-all-filters').click();
    await expect(todoByTitle(page, 'Alpha todo')).toBeVisible();
    await expect(todoByTitle(page, 'Beta todo')).toBeVisible();
    await expect(page.getByTestId('clear-all-filters')).toHaveCount(0);
  });

  test('shows the filtered-empty state, distinct from the no-todos state', async ({ page }) => {
    await createTodo(page, 'Only todo');

    await page.getByTestId('search-input').fill('nothing matches this');

    await expect(page.getByTestId('empty-filtered')).toBeVisible();
    await expect(page.getByTestId('empty-no-todos')).toHaveCount(0);
  });

  test('a saved preset survives a reload and reproduces the filtered view', async ({ page }) => {
    await createTodo(page, 'Urgent item', { priority: 'high' });
    await createTodo(page, 'Relaxed item', { priority: 'low' });

    await page.getByTestId('priority-filter').selectOption('high');
    await page.getByTestId('save-filter-button').click();
    await expect(page.getByTestId('filter-preview')).toContainText('Priority: High');
    await page.getByTestId('preset-name-input').fill('High only');
    await page.getByTestId('save-preset-button').click();

    await page.reload();
    await page.getByTestId('advanced-toggle').click();
    await page.getByRole('button', { name: 'High only' }).click();

    await expect(todoByTitle(page, 'Urgent item')).toBeVisible();
    await expect(todoByTitle(page, 'Relaxed item')).toHaveCount(0);
  });

  test('deleting a preset removes it for good', async ({ page }) => {
    await createTodo(page, 'Some todo', { priority: 'high' });

    await page.getByTestId('priority-filter').selectOption('high');
    await page.getByTestId('save-filter-button').click();
    await page.getByTestId('preset-name-input').fill('Doomed preset');
    await page.getByTestId('save-preset-button').click();

    await page.getByTestId('advanced-toggle').click();
    page.once('dialog', (dialog) => void dialog.accept());
    await page.getByLabel('Delete preset Doomed preset').click();
    await expect(page.getByRole('button', { name: 'Doomed preset' })).toHaveCount(0);

    await page.reload();
    await page.getByTestId('advanced-toggle').click();
    await expect(page.getByRole('button', { name: 'Doomed preset' })).toHaveCount(0);
  });

  test('section counters reflect post-filter counts', async ({ page }) => {
    await createTodo(page, 'High one', { priority: 'high' });
    await createTodo(page, 'High two', { priority: 'high' });
    await createTodo(page, 'Low one', { priority: 'low' });

    await expect(page.getByTestId('section-pending-heading')).toHaveText('Pending (3)');

    await page.getByTestId('priority-filter').selectOption('high');
    await expect(page.getByTestId('section-pending-heading')).toHaveText('Pending (2)');
  });
});
