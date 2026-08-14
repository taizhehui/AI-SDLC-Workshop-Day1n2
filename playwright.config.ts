import { defineConfig, devices } from '@playwright/test';

const PORT = Number(process.env.PORT ?? 3000);
const BASE_URL = process.env.BASE_URL ?? `http://localhost:${PORT}`;

/**
 * E2E configuration.
 *
 * Passkey flows are driven by Chromium's **virtual authenticator** (CDP
 * `WebAuthn.addVirtualAuthenticator`, wired up in `tests/helpers.ts`) — a real biometric
 * prompt is outside Playwright's control. The flags below enable that API.
 *
 * `timezoneId` is pinned to Asia/Singapore so the browser's clock matches the app's.
 */
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  // The app writes to a single SQLite file, so parallel workers would race each other.
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [['html'], ['list']] : 'list',
  timeout: 30_000,
  expect: { timeout: 7_000 },

  use: {
    baseURL: BASE_URL,
    timezoneId: 'Asia/Singapore',
    locale: 'en-SG',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: {
          args: [
            '--enable-features=WebAuthentication,WebAuthenticationRemoteDesktopSupport',
            '--disable-features=WebAuthenticationUseNativeWinApi',
          ],
        },
      },
    },
  ],

  webServer: {
    command: 'npm run dev',
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      JWT_SECRET: 'playwright-e2e-secret-value-at-least-32-chars',
      RP_ID: 'localhost',
      RP_NAME: 'Todo App',
      RP_ORIGIN: BASE_URL,
    },
  },
});
