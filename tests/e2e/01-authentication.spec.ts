import { expect, test } from '@playwright/test';
import { installVirtualAuthenticator, registerAndLogin, uniqueUsername } from './helpers';

/** PRP 11 — WebAuthn/Passkeys authentication. */
test.describe('Authentication', () => {
  test('registers a new user and lands on the todo list', async ({ page }) => {
    await installVirtualAuthenticator(page);
    await registerAndLogin(page);
    await expect(page).toHaveURL('/');
  });

  test('rejects a username that is already taken', async ({ page }) => {
    await installVirtualAuthenticator(page);
    const username = await registerAndLogin(page);

    await page.getByTestId('logout-button').click();
    await page.waitForURL('/login');

    await page.getByTestId('username-input').fill(username);
    await page.getByTestId('register-button').click();

    await expect(page.getByTestId('auth-error')).toContainText('Username already taken');
    await expect(page).toHaveURL(/\/login/);
  });

  test('logs back in with a previously registered passkey', async ({ page }) => {
    await installVirtualAuthenticator(page);
    const username = await registerAndLogin(page);

    await page.getByTestId('logout-button').click();
    await page.waitForURL('/login');

    await page.getByTestId('username-input').fill(username);
    await page.getByTestId('login-button').click();

    await page.waitForURL('/');
    await expect(page.getByTestId('todo-form')).toBeVisible();
  });

  test('shows an error when logging in with an unregistered username', async ({ page }) => {
    await installVirtualAuthenticator(page);
    await page.goto('/login');

    await page.getByTestId('username-input').fill(uniqueUsername('ghost'));
    await page.getByTestId('login-button').click();

    await expect(page.getByTestId('auth-error')).toContainText('No passkey registered');
  });

  test('logging out blocks access to the protected list route', async ({ page }) => {
    await installVirtualAuthenticator(page);
    await registerAndLogin(page);

    await page.getByTestId('logout-button').click();
    await page.waitForURL('/login');

    await page.goto('/');
    await expect(page).toHaveURL(/\/login/);
  });

  test('session survives a full page reload', async ({ page }) => {
    await installVirtualAuthenticator(page);
    await registerAndLogin(page);

    await page.reload();
    await expect(page).toHaveURL('/');
    await expect(page.getByTestId('todo-form')).toBeVisible();
  });

  test('redirects an unauthenticated visit to /calendar', async ({ page }) => {
    await page.goto('/calendar');
    await expect(page).toHaveURL(/\/login/);
  });

  test('redirects an already-authenticated visit to /login', async ({ page }) => {
    await installVirtualAuthenticator(page);
    await registerAndLogin(page);

    await page.goto('/login');
    await expect(page).toHaveURL('/');
  });

  /**
   * A signed-in user enrolling a second device must not be treated as a username conflict.
   *
   * Only the challenge-issuing half is asserted here: completing the enrolment needs a
   * genuinely distinct authenticator, and driving `navigator.credentials.create` against a
   * chosen virtual device is outside what CDP exposes. Full two-device login stays a manual
   * check (see README "Manual test checklist").
   */
  test('lets a signed-in user request a challenge for an additional device', async ({ page }) => {
    await installVirtualAuthenticator(page);
    const username = await registerAndLogin(page);

    const status = await page.evaluate(async (name) => {
      const response = await fetch('/api/auth/register-options', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: name }),
      });
      return response.status;
    }, username);

    expect(status).toBe(200);
  });

  test('still rejects a taken username for a signed-out visitor', async ({ page }) => {
    await installVirtualAuthenticator(page);
    const username = await registerAndLogin(page);

    await page.getByTestId('logout-button').click();
    await page.waitForURL('/login');

    const status = await page.evaluate(async (name) => {
      const response = await fetch('/api/auth/register-options', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: name }),
      });
      return response.status;
    }, username);

    expect(status).toBe(409);
  });
});
