import { expect, test } from '@playwright/test';
import {
  createTodo,
  dueDateInMinutes,
  installVirtualAuthenticator,
  registerAndLogin,
  todoByTitle,
} from './helpers';

/**
 * PRP 04 — Reminders & notifications.
 *
 * OS-level notification rendering is outside Playwright's control, so these tests assert the
 * badge UI, the control's dependency on a due date, and the `/api/notifications/check`
 * contract. Actual notification firing is on the manual checklist in the README.
 */
test.describe('Reminders', () => {
  test.beforeEach(async ({ page }) => {
    await installVirtualAuthenticator(page);
    await registerAndLogin(page);
  });

  test('the reminder select is disabled until a due date is set', async ({ page }) => {
    await page.getByTestId('todo-title-input').fill('Needs a due date');
    await expect(page.getByTestId('create-reminder')).toBeDisabled();

    await page.getByTestId('create-due-date').fill(dueDateInMinutes(120));
    await expect(page.getByTestId('create-reminder')).toBeEnabled();
  });

  test('offers exactly seven presets plus None', async ({ page }) => {
    const values = await page
      .getByTestId('create-reminder')
      .locator('option')
      .evaluateAll((nodes) => nodes.map((node) => (node as HTMLOptionElement).value));

    expect(values).toEqual(['', '15', '30', '60', '120', '1440', '2880', '10080']);
  });

  test('renders the correct abbreviation for each preset', async ({ page }) => {
    const cases = [
      { minutes: 15, label: '🔔 15m' },
      { minutes: 30, label: '🔔 30m' },
      { minutes: 60, label: '🔔 1h' },
      { minutes: 120, label: '🔔 2h' },
      { minutes: 1440, label: '🔔 1d' },
      { minutes: 2880, label: '🔔 2d' },
      { minutes: 10080, label: '🔔 1w' },
    ];

    for (const { minutes, label } of cases) {
      const title = `Reminder ${minutes}`;
      await createTodo(page, title, {
        dueDate: dueDateInMinutes(20_000),
        reminderMinutes: minutes,
      });
      await expect(todoByTitle(page, title).getByTestId('reminder-badge')).toHaveText(label);
    }
  });

  test('the check endpoint returns a todo whose reminder window has opened', async ({ page }) => {
    const result = await page.evaluate(async () => {
      // Due in 10 minutes with a 1-day reminder: the window opened long ago.
      const due = new Date(Date.now() + 10 * 60_000);
      const pad = (value: number) => String(value).padStart(2, '0');
      const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Singapore',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      }).formatToParts(due);
      const get = (type: string) => parts.find((part) => part.type === type)?.value ?? '00';
      const dueDate = `${get('year')}-${get('month')}-${get('day')}T${pad(
        Number(get('hour')) % 24,
      )}:${get('minute')}:${get('second')}`;

      await fetch('/api/todos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Due very soon',
          due_date: dueDate,
          reminder_minutes: 1440,
        }),
      });

      const check = await fetch('/api/notifications/check');
      return check.json();
    });

    expect(result.success).toBe(true);
    expect(result.data.map((todo: { title: string }) => todo.title)).toContain('Due very soon');
  });

  test('a stamped notification is excluded from the next check', async ({ page }) => {
    const titles = await page.evaluate(async () => {
      const check = await fetch('/api/notifications/check');
      const { data } = await check.json();

      for (const todo of data) {
        await fetch(`/api/todos/${todo.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ last_notification_sent: '2030-01-01T00:00:00' }),
        });
      }

      const second = await fetch('/api/notifications/check');
      return (await second.json()).data.map((todo: { title: string }) => todo.title);
    });

    expect(titles).toEqual([]);
  });

  test('editing the due date re-arms an already-fired reminder', async ({ page }) => {
    const stamp = await page.evaluate(async () => {
      const create = await fetch('/api/todos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Re-armed reminder',
          due_date: '2030-06-01T09:00:00',
          reminder_minutes: 60,
        }),
      });
      const todo = await create.json();

      await fetch(`/api/todos/${todo.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ last_notification_sent: '2030-05-01T00:00:00' }),
      });

      // Moving the deadline must clear the stamp so the reminder can fire again.
      const moved = await fetch(`/api/todos/${todo.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ due_date: '2030-07-01T09:00:00' }),
      });
      return (await moved.json()).todo.last_notification_sent;
    });

    expect(stamp).toBeNull();
  });

  test('shows the notification opt-in control', async ({ page }) => {
    await expect(page.getByTestId('notification-toggle')).toContainText('Notifications');
  });
});
