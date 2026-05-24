import { test, expect } from '@playwright/test';
import { existsSync } from 'fs';
import { join } from 'path';

/**
 * E2E happy path: register → dashboard → log session → session detail.
 *
 * PREREQUISITE: `pnpm convex dev` must have been run at least once from
 * apps/topout/ so that `convex/_generated/api.js` exists and the dev server
 * can start.
 *
 * If the generated file is absent, the entire spec is skipped with a clear
 * message rather than failing with a cryptic error.
 */

const CONVEX_GENERATED = join(
  __dirname,
  '../../../../convex/_generated/api.js',
);

const convexBootstrapped = existsSync(CONVEX_GENERATED);

test.describe('auth and session happy path', () => {
  test.skip(!convexBootstrapped, 'Requires convex bootstrap: run `pnpm convex dev` from apps/topout/ first');

  test('e2e register → dashboard → log session → session detail', async ({ page }) => {
    // ── Register ───────────────────────────────────────────────────────────
    await page.goto('/register');
    await expect(page).toHaveURL(/register/);

    // Fill registration form.
    const email = `test-${Date.now()}@topout.test`;
    const password = 'TestPassword1!';

    await page.getByLabel(/email/i).fill(email);
    await page.getByLabel(/password/i).fill(password);

    // Some register forms have a "display name" or "name" field.
    const nameInput = page.getByLabel(/name/i).first();
    if (await nameInput.isVisible()) {
      await nameInput.fill('E2E Tester');
    }

    await page.getByRole('button', { name: /register|sign up|create account/i }).click();

    // Should land on /dashboard.
    await expect(page).toHaveURL(/dashboard/, { timeout: 15_000 });

    // ── Dashboard ──────────────────────────────────────────────────────────
    // Nav links are present.
    await expect(page.getByRole('navigation', { name: /primary/i }).first()).toBeVisible();

    // ── Navigate to new session form ───────────────────────────────────────
    // Look for a "Log session" CTA (on the dashboard or via the sessions link).
    const logBtn = page.getByRole('link', { name: /log session|new session/i }).first();
    if (await logBtn.isVisible()) {
      await logBtn.click();
    } else {
      // Fall back: navigate directly.
      await page.goto('/sessions/new');
    }

    await expect(page).toHaveURL(/sessions\/new/);

    // ── Fill the session form ──────────────────────────────────────────────
    const gymInput = page.getByPlaceholder(/type to search or create/i);
    await gymInput.fill('E2E Test Gym');

    // Click the "Create …" option in the combobox dropdown.
    const createOption = page.getByRole('button', { name: /create/i }).first();
    if (await createOption.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await createOption.click();
    }

    // Effort slider is already at 7 — leave as-is.
    // Attempts: one default V3 Send is already there.

    await page.getByRole('button', { name: /log session/i }).click();

    // ── Verify session detail ─────────────────────────────────────────────
    await expect(page).toHaveURL(/sessions\/[^/]+$/, { timeout: 15_000 });

    // Session detail should contain the gym name somewhere.
    await expect(page.getByText('E2E Test Gym')).toBeVisible();

    // No unexpected console errors.
    // (Convex WebSocket debug logs are expected — we only fail on 'error' level.)
    // Playwright doesn't expose console errors here without listeners;
    // that's fine for a first-pass slim suite.
  });
});
