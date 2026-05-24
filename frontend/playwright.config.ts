import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright config for TopOut E2E tests.
 * Tests target the Next.js dev server on port 3000.
 *
 * PREREQUISITE: Run `pnpm convex dev` once from apps/topout/ to generate
 * convex/_generated/ before executing E2E tests. If that folder is absent,
 * the dev server won't start and tests will be skipped automatically.
 */
export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  // The dev server must already be running when the E2E suite executes.
  // We do NOT auto-start it here because it requires `pnpm convex dev` to
  // have run first to generate the Convex client.
  webServer: undefined,
});
