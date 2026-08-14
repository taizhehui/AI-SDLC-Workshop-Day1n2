import { expect, test } from '@playwright/test';
import {
  addSubtask,
  createTodo,
  installVirtualAuthenticator,
  registerAndLogin,
  todoId,
} from './helpers';

/** PRP 05 — Subtasks & progress tracking. */
test.describe('Subtasks', () => {
  test.beforeEach(async ({ page }) => {
    await installVirtualAuthenticator(page);
    await registerAndLogin(page);
    await createTodo(page, 'Prepare presentation');
  });

  test('shows no progress bar until the first subtask exists', async ({ page }) => {
    const id = await todoId(page, 'Prepare presentation');

    await expect(page.getByTestId('subtask-progress')).toHaveCount(0);
    await page.getByTestId(`subtasks-toggle-${id}`).click();
    await expect(page.getByTestId(`subtask-list-${id}`)).toBeVisible();
    await expect(page.getByTestId('subtask-progress')).toHaveCount(0);
  });

  test('adds a subtask with the Enter key', async ({ page }) => {
    const id = await todoId(page, 'Prepare presentation');
    await page.getByTestId(`subtasks-toggle-${id}`).click();
    await page.getByTestId(`subtask-input-${id}`).fill('Create slides');
    await page.getByTestId(`subtask-input-${id}`).press('Enter');

    await expect(page.getByTestId(`subtask-list-${id}`)).toContainText('Create slides');
    await expect(page.getByTestId('subtask-progress-count')).toHaveText('0/1 subtasks');
  });

  test('adds multiple subtasks with the Add button', async ({ page }) => {
    await addSubtask(page, 'Prepare presentation', 'Create slides');
    await addSubtask(page, 'Prepare presentation', 'Rehearse speech');

    await expect(page.getByTestId('subtask-progress-count')).toHaveText('0/2 subtasks');
  });

  test('completing one of two subtasks keeps the bar below 100%', async ({ page }) => {
    await addSubtask(page, 'Prepare presentation', 'Create slides');
    await addSubtask(page, 'Prepare presentation', 'Rehearse speech');

    const id = await todoId(page, 'Prepare presentation');
    await page
      .getByTestId(`subtask-list-${id}`)
      .getByRole('checkbox')
      .first()
      .check();

    await expect(page.getByTestId('subtask-progress-count')).toHaveText('1/2 subtasks');
    await expect(page.getByTestId('subtask-progress')).toHaveAttribute('data-percent', '50');
  });

  test('completing every subtask reaches 100%', async ({ page }) => {
    await addSubtask(page, 'Prepare presentation', 'Create slides');
    await addSubtask(page, 'Prepare presentation', 'Rehearse speech');

    const id = await todoId(page, 'Prepare presentation');
    const checkboxes = page.getByTestId(`subtask-list-${id}`).getByRole('checkbox');
    const count = await checkboxes.count();
    for (let index = 0; index < count; index += 1) {
      await checkboxes.nth(index).check();
    }

    await expect(page.getByTestId('subtask-progress')).toHaveAttribute('data-percent', '100');
    await expect(page.getByTestId('subtask-progress-count')).toHaveText('2/2 subtasks');
  });

  test('does not auto-complete the parent when every subtask is done', async ({ page }) => {
    await addSubtask(page, 'Prepare presentation', 'Only step');

    const id = await todoId(page, 'Prepare presentation');
    await page.getByTestId(`subtask-list-${id}`).getByRole('checkbox').first().check();

    await expect(page.getByTestId(`todo-checkbox-${id}`)).not.toBeChecked();
    await expect(page.getByTestId('section-pending')).toContainText('Prepare presentation');
  });

  test('deleting a subtask recalculates progress', async ({ page }) => {
    await addSubtask(page, 'Prepare presentation', 'Keep me');
    await addSubtask(page, 'Prepare presentation', 'Remove me');

    await page.getByLabel('Delete subtask "Remove me"').click();

    await expect(page.getByTestId('subtask-progress-count')).toHaveText('0/1 subtasks');
    await expect(page.getByText('Remove me')).toHaveCount(0);
  });

  test('progress stays visible when the checklist is collapsed', async ({ page }) => {
    await addSubtask(page, 'Prepare presentation', 'Create slides');

    const id = await todoId(page, 'Prepare presentation');
    await page.getByTestId(`subtasks-toggle-${id}`).click();

    await expect(page.getByTestId(`subtask-list-${id}`)).toHaveCount(0);
    await expect(page.getByTestId('subtask-progress-count')).toBeVisible();
  });

  test('does not accept a whitespace-only subtask title', async ({ page }) => {
    const id = await todoId(page, 'Prepare presentation');
    await page.getByTestId(`subtasks-toggle-${id}`).click();
    await page.getByTestId(`subtask-input-${id}`).fill('   ');

    await expect(page.getByTestId(`subtask-add-${id}`)).toBeDisabled();
    await expect(page.getByTestId('subtask-progress')).toHaveCount(0);
  });

  test('assigns positions as max + 1 and does not renumber on delete', async ({ page }) => {
    const id = Number(await todoId(page, 'Prepare presentation'));
    await addSubtask(page, 'Prepare presentation', 'First');
    await addSubtask(page, 'Prepare presentation', 'Second');
    await addSubtask(page, 'Prepare presentation', 'Third');

    const before = await page.evaluate(
      async (todoId) => (await fetch(`/api/todos/${todoId}/subtasks`).then((r) => r.json())) as
        Array<{ id: number; title: string; position: number }>,
      id,
    );
    expect(before.map((subtask) => subtask.position)).toEqual([0, 1, 2]);

    const after = await page.evaluate(
      async ({ todoId, subtaskId }) => {
        await fetch(`/api/subtasks/${subtaskId}`, { method: 'DELETE' });
        return (await fetch(`/api/todos/${todoId}/subtasks`).then((r) => r.json())) as Array<{
          title: string;
          position: number;
        }>;
      },
      { todoId: id, subtaskId: before[1].id },
    );

    // Gaps are intentional: deletes stay O(1) rather than compacting siblings.
    expect(after.map((subtask) => subtask.position)).toEqual([0, 2]);
    expect(after.map((subtask) => subtask.title)).toEqual(['First', 'Third']);
  });
});
