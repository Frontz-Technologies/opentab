import { expect, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";

/**
 * Test user fixture.
 *
 * `email` is randomised per `pnpm e2e` run (one randomUUID slice per
 * test process, shared across all specs in that run via module cache).
 * This prevents cross-run user-state leakage: previous runs'
 * `e2e@opentab.dev` rows that may have been left in different states
 * don't collide with the current run. See #178.
 */
const RUN_ID = randomUUID().slice(0, 8);
export const TEST_USER = {
  name: "E2E Test User",
  email: `e2e-${RUN_ID}@opentab.dev`,
  password: "E2eTestPass123!",
};

export async function registerTestUser(page: Page): Promise<void> {
  const response = await page.request.post("/api/auth/sign-up/email", {
    data: {
      name: TEST_USER.name,
      email: TEST_USER.email,
      password: TEST_USER.password,
    },
  });

  // 2xx = created successfully. Non-2xx usually means "user already
  // exists" (expected when multiple specs call registerTestUser within
  // the same run — only the first succeeds). Log but do not throw —
  // loginTestUser below will surface any real credentials problem with
  // a precise 4xx status.
  if (!response.ok()) {
    console.info(
      `[e2e helpers] sign-up returned ${response.status()} for ${TEST_USER.email} ` +
        `(expected 'already exists' on repeat calls; proceeding to login)`,
    );
  }

  await loginTestUser(page);
}

export async function loginTestUser(page: Page): Promise<void> {
  const response = await page.request.post("/api/auth/sign-in/email", {
    data: {
      email: TEST_USER.email,
      password: TEST_USER.password,
    },
  });

  if (!response.ok()) {
    throw new Error(
      `Login API failed: ${response.status()} for ${TEST_USER.email}`,
    );
  }

  // Navigate to dashboard with session cookie set.
  await page.goto("/dashboard", { timeout: 15000 });

  // Use URL stability as the post-auth marker rather than a heading
  // assertion. Middleware redirects unauthenticated requests to /login,
  // so staying on /dashboard proves the session is live. This avoids
  // the strict-mode `getByRole("heading", { name: "Dashboard" })`
  // ambiguity when a page renders more than one <h1>/<h2> with that
  // text — the dashboard currently does two (PageHeader + body hero),
  // and more broadly the helper should not be coupled to any
  // page-specific heading copy. See #178.
  await expect(page).toHaveURL(/\/dashboard(?:[/?#]|$)/, { timeout: 10000 });
}

export async function ensureLoggedIn(page: Page): Promise<void> {
  await page.goto("/dashboard", { timeout: 15000 });
  if (page.url().includes("/login")) {
    await loginTestUser(page);
  }
}
