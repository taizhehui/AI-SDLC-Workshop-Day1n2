import { expect, test } from '@playwright/test';
import {
  createTag,
  createTodo,
  installVirtualAuthenticator,
  registerAndLogin,
  todoByTitle,
} from './helpers';

/** PRP 06 — Tag system. */
test.describe('Tags', () => {
  test.beforeEach(async ({ page }) => {
    await installVirtualAuthenticator(page);
    await registerAndLogin(page);
  });

  test('creates a tag and offers it in the pill selector', async ({ page }) => {
    await createTag(page, 'Work', '#ef4444');
    await expect(page.getByTestId('tag-selector').getByText('Work')).toBeVisible();
  });

  test('rejects a duplicate name for the same user', async ({ page }) => {
    await createTag(page, 'Work');

    await page.getByTestId('manage-tags-button').click();
    await page.getByTestId('new-tag-name').fill('Work');
    await page.getByTestId('create-tag-button').click();

    await expect(page.getByTestId('manage-tags-modal')).toContainText(
      'A tag with this name already exists',
    );
  });

  test('attaches two tags to a single todo', async ({ page }) => {
    await createTag(page, 'Work');
    await createTag(page, 'Urgent');

    await createTodo(page, 'Quarterly review', { tagNames: ['Work', 'Urgent'] });

    const todo = todoByTitle(page, 'Quarterly review');
    await expect(todo.locator('[data-tag-name="Work"]')).toBeVisible();
    await expect(todo.locator('[data-tag-name="Urgent"]')).toBeVisible();
  });

  test('renaming a tag updates every todo carrying it', async ({ page }) => {
    await createTag(page, 'Work');
    await createTodo(page, 'Tagged todo', { tagNames: ['Work'] });

    await page.getByTestId('manage-tags-button').click();
    await page.getByRole('button', { name: 'Edit' }).first().click();
    await page.getByLabel('Rename tag Work').fill('Office');
    await page.getByRole('button', { name: 'Update' }).click();
    await page.getByTestId('manage-tags-modal').getByLabel('Close').click();

    await page.reload();
    await expect(todoByTitle(page, 'Tagged todo').locator('[data-tag-name="Office"]')).toBeVisible();
  });

  test('deleting a tag removes it from every todo', async ({ page }) => {
    await createTag(page, 'Temporary');
    await createTodo(page, 'Todo with doomed tag', { tagNames: ['Temporary'] });

    page.once('dialog', (dialog) => void dialog.accept());
    await page.getByTestId('manage-tags-button').click();
    await page.getByRole('button', { name: 'Delete' }).first().click();
    await page.getByTestId('manage-tags-modal').getByLabel('Close').click();

    await page.reload();
    await expect(
      todoByTitle(page, 'Todo with doomed tag').locator('[data-tag-name="Temporary"]'),
    ).toHaveCount(0);
  });

  test('filters the list by tag and clears again', async ({ page }) => {
    await createTag(page, 'Work');
    await createTodo(page, 'Work item', { tagNames: ['Work'] });
    await createTodo(page, 'Personal item');

    await page.getByTestId('tag-filter').selectOption({ label: 'Work' });
    await expect(todoByTitle(page, 'Work item')).toBeVisible();
    await expect(todoByTitle(page, 'Personal item')).toHaveCount(0);

    await page.getByTestId('tag-filter').selectOption('all');
    await expect(todoByTitle(page, 'Personal item')).toBeVisible();
  });

  test('clicking a tag pill on a card applies it as the filter', async ({ page }) => {
    await createTag(page, 'Errands');
    await createTodo(page, 'Buy stamps', { tagNames: ['Errands'] });
    await createTodo(page, 'Unrelated todo');

    await todoByTitle(page, 'Buy stamps').locator('[data-tag-name="Errands"]').click();

    await expect(todoByTitle(page, 'Buy stamps')).toBeVisible();
    await expect(todoByTitle(page, 'Unrelated todo')).toHaveCount(0);
  });

  test('rejects an invalid hex colour at the API layer', async ({ page }) => {
    const status = await page.evaluate(async () => {
      const response = await fetch('/api/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Bad colour', color: 'red' }),
      });
      return response.status;
    });

    expect(status).toBe(400);
  });

  test('attaching and detaching a tag is idempotent', async ({ page }) => {
    await createTag(page, 'Repeatable');
    await createTodo(page, 'Idempotency check');

    const statuses = await page.evaluate(async () => {
      const todos = await fetch('/api/todos').then((r) => r.json());
      const tags = await fetch('/api/tags').then((r) => r.json());
      const todoId = todos.find(
        (todo: { title: string }) => todo.title === 'Idempotency check',
      ).id;
      const tagId = tags[0].id;

      const attach = () =>
        fetch(`/api/todos/${todoId}/tags`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tag_id: tagId }),
        }).then((r) => r.status);
      const detach = () =>
        fetch(`/api/todos/${todoId}/tags`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tag_id: tagId }),
        }).then((r) => r.status);

      return [await attach(), await attach(), await detach(), await detach()];
    });

    expect(statuses).toEqual([200, 200, 200, 200]);
  });
});
