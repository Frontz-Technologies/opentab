import { expect, type Page } from "@playwright/test";

export const TEST_USER = {
  name: "E2E Test User",
  email: "e2e@opentab.dev",
  password: "E2eTestPass123!",
};

export async function registerTestUser(page: Page): Promise<void> {
  // Register via API (idempotent — ignores if user exists)
  await page.request.post("/api/auth/sign-up/email", {
    data: {
      name: TEST_USER.name,
      email: TEST_USER.email,
      password: TEST_USER.password,
    },
  });

  // Login via API to set session cookie (more reliable than UI in CI)
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
    throw new Error(`Login API failed: ${response.status()}`);
  }

  // Navigate to dashboard with session cookie set
  await page.goto("/dashboard", { timeout: 15000 });
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible({
    timeout: 10000,
  });
}

export async function ensureLoggedIn(page: Page): Promise<void> {
  await page.goto("/dashboard", { timeout: 15000 });
  if (page.url().includes("/login")) {
    await loginTestUser(page);
  }
}
