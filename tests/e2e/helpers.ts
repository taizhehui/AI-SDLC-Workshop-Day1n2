import { expect, type Page } from '@playwright/test';

/**
 * Shared E2E helpers.
 *
 * Passkey flows are driven by Chromium's **virtual authenticator** over CDP — a real
 * biometric prompt cannot be scripted. `installVirtualAuthenticator` must be called before
 * any register/login attempt on a given page.
 */

export interface VirtualAuthenticator {
  authenticatorId: string;
  /** Register a second device for the same account (multi-authenticator tests). */
  addAnother: () => Promise<VirtualAuthenticator>;
  remove: () => Promise<void>;
}

/**
 * Attach a software authenticator that auto-approves prompts.
 *
 * `isUserVerified: true` and `automaticPresenceSimulation: true` together mean the prompt is
 * satisfied without any user gesture, which is what makes the flow scriptable.
 */
export async function installVirtualAuthenticator(page: Page): Promise<VirtualAuthenticator> {
  const client = await page.context().newCDPSession(page);
  await client.send('WebAuthn.enable');

  const add = async (): Promise<VirtualAuthenticator> => {
    const { authenticatorId } = await client.send('WebAuthn.addVirtualAuthenticator', {
      options: {
        protocol: 'ctap2',
        transport: 'internal',
        hasResidentKey: true,
        hasUserVerification: true,
        isUserVerified: true,
        automaticPresenceSimulation: true,
      },
    });

    return {
      authenticatorId,
      addAnother: add,
      remove: async () => {
        await client.send('WebAuthn.removeVirtualAuthenticator', { authenticatorId });
      },
    };
  };

  return add();
}

/** Username that will not collide with other runs against the same database file. */
export function uniqueUsername(prefix = 'user'): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 10_000)}`;
}

/** Register a fresh account and land on a fully-loaded todo list. */
export async function registerAndLogin(page: Page, username = uniqueUsername()): Promise<string> {
  await page.goto('/login');
  await page.getByTestId('username-input').fill(username);
  await page.getByTestId('register-button').click();
  await page.waitForURL('/');
  await expect(page.getByTestId('todo-form')).toBeVisible();
  // The form renders before `GET /api/todos` resolves; wait it out so a test's first create
  // is not interleaved with the initial load.
  await expect(page.getByText('Loading your todos…')).toHaveCount(0);
  return username;
}

export interface CreateTodoOptions {
  priority?: 'high' | 'medium' | 'low';
  /** `<input type="datetime-local">` value, `YYYY-MM-DDTHH:mm`. */
  dueDate?: string;
  recurrence?: 'daily' | 'weekly' | 'monthly' | 'yearly';
  reminderMinutes?: number;
  tagNames?: string[];
}

/** Fill the create form and submit, waiting for the new row to appear. */
export async function createTodo(
  page: Page,
  title: string,
  options: CreateTodoOptions = {},
): Promise<void> {
  await page.getByTestId('todo-title-input').fill(title);

  if (options.priority) {
    await page.getByTestId('create-priority').selectOption(options.priority);
  }
  if (options.dueDate) {
    await page.getByTestId('create-due-date').fill(options.dueDate);
  }
  if (options.recurrence) {
    await page.getByTestId('create-repeat').check();
    await page.getByTestId('create-pattern').selectOption(options.recurrence);
  }
  if (options.reminderMinutes) {
    await page.getByTestId('create-reminder').selectOption(String(options.reminderMinutes));
  }
  for (const tagName of options.tagNames ?? []) {
    await page
      .getByTestId('tag-selector')
      .locator(`[data-tag-name="${tagName}"]`)
      .click();
  }

  await page.getByTestId('add-todo-button').click();
  await expect(todoByTitle(page, title)).toBeVisible();
}

/** Locate a todo row by its title. */
export function todoByTitle(page: Page, title: string) {
  return page.locator(`[data-todo-title="${title}"]`);
}

/** The numeric id of a todo row, needed for the per-todo test ids. */
export async function todoId(page: Page, title: string): Promise<string> {
  const testId = await todoByTitle(page, title).getAttribute('data-testid');
  return (testId ?? '').replace('todo-item-', '');
}

/** Expand a todo's checklist and add one subtask. */
export async function addSubtask(page: Page, title: string, subtaskTitle: string): Promise<void> {
  const id = await todoId(page, title);
  const toggle = page.getByTestId(`subtasks-toggle-${id}`);

  if (!(await page.getByTestId(`subtask-list-${id}`).isVisible())) {
    await toggle.click();
  }

  await page.getByTestId(`subtask-input-${id}`).fill(subtaskTitle);
  await page.getByTestId(`subtask-add-${id}`).click();
  await expect(page.getByTestId(`subtask-list-${id}`).getByText(subtaskTitle)).toBeVisible();
}

/** Create a tag through the Manage Tags modal. */
export async function createTag(page: Page, name: string, color = '#3B82F6'): Promise<void> {
  await page.getByTestId('manage-tags-button').click();
  await page.getByTestId('new-tag-name').fill(name);
  await page.getByTestId('new-tag-color').fill(color);
  await page.getByTestId('create-tag-button').click();
  await expect(page.getByTestId('manage-tags-modal').getByText(name)).toBeVisible();
  await page.getByTestId('manage-tags-modal').getByLabel('Close').click();
}

/** Singapore-local `datetime-local` value offset from now by whole minutes. */
export function dueDateInMinutes(minutes: number): string {
  const target = new Date(Date.now() + minutes * 60_000);
  const singapore = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Singapore',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(target);

  const get = (type: string) => singapore.find((part) => part.type === type)?.value ?? '00';
  const hour = String(Number(get('hour')) % 24).padStart(2, '0');
  return `${get('year')}-${get('month')}-${get('day')}T${hour}:${get('minute')}`;
}
