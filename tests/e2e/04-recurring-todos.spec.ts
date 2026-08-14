import { expect, test } from '@playwright/test';
import {
  createTodo,
  dueDateInMinutes,
  installVirtualAuthenticator,
  registerAndLogin,
  todoByTitle,
  todoId,
} from './helpers';

/** PRP 03 — Recurring todos. */
test.describe('Recurring todos', () => {
  test.beforeEach(async ({ page }) => {
    await installVirtualAuthenticator(page);
    await registerAndLogin(page);
  });

  test('shows the 🔄 badge with the chosen pattern', async ({ page }) => {
    await createTodo(page, 'Daily standup', {
      dueDate: dueDateInMinutes(120),
      recurrence: 'daily',
    });

    const badge = todoByTitle(page, 'Daily standup').getByTestId('recurrence-badge');
    await expect(badge).toBeVisible();
    await expect(badge).toHaveAttribute('data-pattern', 'daily');
  });

  test('disables Repeat until a due date is set', async ({ page }) => {
    await page.getByTestId('todo-title-input').fill('No due date yet');
    await expect(page.getByTestId('create-repeat')).toBeDisabled();

    await page.getByTestId('create-due-date').fill(dueDateInMinutes(60));
    await expect(page.getByTestId('create-repeat')).toBeEnabled();
  });

  test('rejects a recurring todo without a due date at the API layer', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const response = await fetch('/api/todos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Recurring without due date',
          is_recurring: true,
          recurrence_pattern: 'weekly',
        }),
      });
      return { status: response.status, body: await response.json() };
    });

    expect(result.status).toBe(400);
    expect(result.body.error).toBe('Recurring todos require a due date');
  });

  test('rejects an invalid recurrence pattern', async ({ page }) => {
    const status = await page.evaluate(async () => {
      const response = await fetch('/api/todos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Bad pattern',
          due_date: '2030-01-01T09:00:00',
          is_recurring: true,
          recurrence_pattern: 'fortnightly',
        }),
      });
      return response.status;
    });

    expect(status).toBe(400);
  });

  test('completing a weekly todo creates the next instance seven days later', async ({ page }) => {
    const created = await page.evaluate(async () => {
      const response = await fetch('/api/todos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Weekly report',
          due_date: '2030-03-01T09:00:00',
          priority: 'high',
          is_recurring: true,
          recurrence_pattern: 'weekly',
          reminder_minutes: 60,
        }),
      });
      return response.json();
    });

    const result = await page.evaluate(async (id) => {
      const response = await fetch(`/api/todos/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completed: true }),
      });
      return response.json();
    }, created.id);

    expect(result.nextInstance).not.toBeNull();
    expect(result.nextInstance.due_date).toBe('2030-03-08T09:00:00');
    expect(result.nextInstance.completed).toBe(false);
    // Metadata carries forward from the completed instance.
    expect(result.nextInstance.priority).toBe('high');
    expect(result.nextInstance.recurrence_pattern).toBe('weekly');
    expect(result.nextInstance.reminder_minutes).toBe(60);
  });

  test('a monthly todo due Jan 31 rolls to Feb 28, not March', async ({ page }) => {
    const nextDue = await page.evaluate(async () => {
      const create = await fetch('/api/todos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Pay rent',
          due_date: '2030-01-31T09:00:00',
          is_recurring: true,
          recurrence_pattern: 'monthly',
        }),
      });
      const todo = await create.json();

      const update = await fetch(`/api/todos/${todo.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completed: true }),
      });
      return (await update.json()).nextInstance.due_date;
    });

    expect(nextDue).toBe('2030-02-28T09:00:00');
  });

  test('a double completion does not create a duplicate next instance', async ({ page }) => {
    const secondResult = await page.evaluate(async () => {
      const create = await fetch('/api/todos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Double submit guard',
          due_date: '2030-04-01T09:00:00',
          is_recurring: true,
          recurrence_pattern: 'daily',
        }),
      });
      const todo = await create.json();

      const complete = () =>
        fetch(`/api/todos/${todo.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ completed: true }),
        }).then((response) => response.json());

      await complete();
      return complete();
    });

    // The second PUT is not a false -> true transition, so it must spawn nothing.
    expect(secondResult.nextInstance).toBeNull();
  });

  test('unchecking Repeat stops future recurrence', async ({ page }) => {
    await createTodo(page, 'Stop repeating', {
      dueDate: dueDateInMinutes(90),
      recurrence: 'daily',
    });

    const id = await todoId(page, 'Stop repeating');
    await page.getByTestId(`todo-edit-${id}`).click();
    await page.getByTestId('edit-repeat').uncheck();
    await page.getByTestId('update-todo-button').click();
    await expect(page.getByTestId('todo-edit-modal')).toHaveCount(0);

    await expect(
      todoByTitle(page, 'Stop repeating').getByTestId('recurrence-badge'),
    ).toHaveCount(0);

    const nextInstance = await page.evaluate(async (todoId) => {
      const response = await fetch(`/api/todos/${todoId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completed: true }),
      });
      return (await response.json()).nextInstance;
    }, Number(id));

    expect(nextInstance).toBeNull();
  });
});
