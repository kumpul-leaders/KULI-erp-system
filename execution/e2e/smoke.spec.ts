/**
 * Smoke tests — no login required.
 *
 * These tests verify publicly-accessible pages and auth redirect behavior
 * without needing a valid Supabase session.
 *
 * Tests that require a logged-in user (create lead, drag pipeline stage, etc.)
 * are marked test.skip below. To enable them:
 *   1. Create a dedicated test user in Supabase (role: account_manager is sufficient)
 *   2. Add PLAYWRIGHT_EMAIL and PLAYWRIGHT_PASSWORD to .env
 *   3. Write a shared fixture in e2e/fixtures/auth.ts that performs login once
 *      and stores storageState — reuse via `test.use({ storageState: '...' })`
 *   4. Change test.skip → test on those blocks
 */

import { test, expect } from "@playwright/test"

// ── Auth pages render ─────────────────────────────────────────────────────────

test("/login renders email + password form", async ({ page }) => {
  await page.goto("/login")

  // Page should not redirect away — it's public
  await expect(page).toHaveURL(/\/login/)

  // Email input
  await expect(page.getByRole("textbox", { name: /email/i })).toBeVisible()

  // Password input — Playwright finds by type since label text varies
  await expect(page.locator('input[type="password"]')).toBeVisible()
})

test("/forgot-password renders", async ({ page }) => {
  await page.goto("/forgot-password")

  await expect(page).toHaveURL(/\/forgot-password/)
  // At minimum an email input should exist on the page
  await expect(page.getByRole("textbox", { name: /email/i })).toBeVisible()
})

// ── Auth guard redirect ───────────────────────────────────────────────────────

test("/dashboard without auth redirects to /login", async ({ page }) => {
  await page.goto("/dashboard")

  // Middleware/server should redirect unauthenticated users to login
  await expect(page).toHaveURL(/\/login/)
})

// ── Authenticated flows (require test credentials — DISABLED) ─────────────────

test.skip("create lead via /leads page [requires auth]", async ({ page }) => {
  // TODO: enable once PLAYWRIGHT_EMAIL + PLAYWRIGHT_PASSWORD are set in .env
  // and an auth fixture (e2e/fixtures/auth.ts) is wired up.
  // Steps:
  //   1. Authenticate via storageState fixture
  //   2. Navigate to /leads
  //   3. Click "New Lead" button
  //   4. Fill form and submit
  //   5. Assert new lead appears in pipeline board
  void page
})

test.skip("drag lead card to different stage [requires auth]", async ({ page }) => {
  // TODO: enable with auth fixture.
  // Steps:
  //   1. Navigate to /leads with a seeded lead in 'leads' stage
  //   2. Drag card to 'pipeline' column using page.dragAndDrop()
  //   3. Assert card is now in 'pipeline' column
  void page
})
