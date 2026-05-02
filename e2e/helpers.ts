import { expect, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";

/**
 * Test user fixture.
 *
 * `email` uses `OPENTAB_E2E_RUN_ID`, which Playwright's config
 * generates once per invocation and exports to every worker via
 * process env. This gives every spec in the same `pnpm e2e` run the
 * same email (so cross-spec `loginTestUser` hits the user that
 * `registerTestUser` just created) while still rotating between runs
 * (so yesterday's leftover `e2e-*` rows never collide).
 *
 * A local fallback UUID is used if the env var is unset — e.g. when
 * running a helper import outside Playwright for ad-hoc scripts.
 */
const RUN_ID = process.env.OPENTAB_E2E_RUN_ID ?? randomUUID().slice(0, 8);
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
  // so staying on /dashboard proves the session is live. The dashboard
  // hero is a time-based greeting ("Good morning, {name}"), so coupling
  // helpers to a specific heading string would be brittle.
  await expect(page).toHaveURL(/\/dashboard(?:[/?#]|$)/, { timeout: 10000 });
}

export async function ensureLoggedIn(page: Page): Promise<void> {
  await page.goto("/dashboard", { timeout: 15000 });
  if (page.url().includes("/login")) {
    await loginTestUser(page);
  }
}
