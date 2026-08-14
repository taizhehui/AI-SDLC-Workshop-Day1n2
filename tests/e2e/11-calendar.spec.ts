import { expect, test } from '@playwright/test';
import {
  createTodo,
  dueDateInMinutes,
  installVirtualAuthenticator,
  registerAndLogin,
} from './helpers';

/** PRP 10 — Calendar view. */
test.describe('Calendar view', () => {
  test.beforeEach(async ({ page }) => {
    await installVirtualAuthenticator(page);
    await registerAndLogin(page);
  });

  test('navigates from the list to the current month', async ({ page }) => {
    await page.getByTestId('nav-calendar').click();
    await page.waitForURL(/\/calendar/);

    const expected = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Singapore',
      month: 'long',
      year: 'numeric',
    }).format(new Date());

    await expect(page.getByTestId('calendar-month-label')).toHaveText(expected);
  });

  test('always renders 7 day headers and 42 cells', async ({ page }) => {
    await page.goto('/calendar');

    for (const label of ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']) {
      await expect(page.getByText(label, { exact: true })).toBeVisible();
    }
    await expect(page.locator('[data-testid^="calendar-cell-"]')).toHaveCount(42);
  });

  test('places a todo on its due-date cell', async ({ page }) => {
    const dueDate = dueDateInMinutes(180);
    await createTodo(page, 'Calendar todo', { dueDate });

    await page.getByTestId('nav-calendar').click();
    await page.waitForURL(/\/calendar/);

    const cell = page.getByTestId(`calendar-cell-${dueDate.slice(0, 10)}`);
    await expect(cell).toContainText('Calendar todo');
  });

  test('highlights exactly one cell as today', async ({ page }) => {
    await page.goto('/calendar');
    await expect(page.locator('[data-testid^="calendar-cell-"][data-today="true"]')).toHaveCount(1);
  });

  test('marks Sunday and Saturday columns as weekend', async ({ page }) => {
    await page.goto('/calendar');
    // 6 rows x 2 weekend columns.
    await expect(
      page.locator('[data-testid^="calendar-cell-"][data-weekend="true"]'),
    ).toHaveCount(12);
  });

  test('prev and next move by exactly one month and update the URL', async ({ page }) => {
    await page.goto('/calendar?month=2026-06');
    await expect(page.getByTestId('calendar-month-label')).toHaveText('June 2026');

    await page.getByTestId('calendar-prev').click();
    await expect(page).toHaveURL(/month=2026-05/);
    await expect(page.getByTestId('calendar-month-label')).toHaveText('May 2026');

    await page.getByTestId('calendar-next').click();
    await page.getByTestId('calendar-next').click();
    await expect(page).toHaveURL(/month=2026-07/);
    await expect(page.getByTestId('calendar-month-label')).toHaveText('July 2026');
  });

  test('rolls the year over when stepping past December', async ({ page }) => {
    await page.goto('/calendar?month=2026-12');
    await page.getByTestId('calendar-next').click();
    await expect(page.getByTestId('calendar-month-label')).toHaveText('January 2027');
  });

  test('Today returns to the current month', async ({ page }) => {
    await page.goto('/calendar?month=2029-01');
    await expect(page.getByTestId('calendar-month-label')).toHaveText('January 2029');

    await page.getByTestId('calendar-today').click();

    const expected = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Singapore',
      month: 'long',
      year: 'numeric',
    }).format(new Date());
    await expect(page.getByTestId('calendar-month-label')).toHaveText(expected);
  });

  test('falls back to the current month for an out-of-range month param', async ({ page }) => {
    await page.goto('/calendar?month=2026-13');

    const expected = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Singapore',
      month: 'long',
      year: 'numeric',
    }).format(new Date());
    await expect(page.getByTestId('calendar-month-label')).toHaveText(expected);
    await expect(page.locator('[data-testid^="calendar-cell-"]')).toHaveCount(42);
  });

  test('falls back to the current month for a malformed month param', async ({ page }) => {
    await page.goto('/calendar?month=abc');
    await expect(page.locator('[data-testid^="calendar-cell-"]')).toHaveCount(42);
  });

  test('renders a seeded Singapore holiday with its name', async ({ page }) => {
    await page.goto('/calendar?month=2026-08');
    // National Day, seeded by scripts/seed-holidays.ts.
    await expect(page.getByTestId('holiday-2026-08-09')).toHaveText('National Day');
  });

  test('clicking a day opens a modal listing that day’s todos', async ({ page }) => {
    const dueDate = dueDateInMinutes(240);
    await createTodo(page, 'Modal todo', { dueDate });

    await page.goto('/calendar');
    await page.getByTestId(`calendar-cell-${dueDate.slice(0, 10)}`).click();

    await expect(page.getByTestId('day-todos-modal')).toBeVisible();
    await expect(page.getByTestId('day-todos-modal')).toContainText('Modal todo');
  });

  test('the day modal shows the holiday name and an empty-todos message', async ({ page }) => {
    await page.goto('/calendar?month=2026-08');
    await page.getByTestId('calendar-cell-2026-08-09').click();

    await expect(page.getByTestId('day-todos-modal')).toContainText('National Day');
    await expect(page.getByTestId('day-todos-modal')).toContainText('No todos due on this day');
  });

  test('never places a todo without a due date on the grid', async ({ page }) => {
    await createTodo(page, 'Undated todo');
    await page.goto('/calendar');

    await expect(page.getByText('Undated todo')).toHaveCount(0);
  });
});
