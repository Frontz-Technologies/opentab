import { expect, type Page } from "@playwright/test";

export const TEST_USER = {
  name: "E2E Test User",
  email: "e2e@opentab.dev",
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

  // 200 = created, ignore if already exists
  if (!response.ok()) {
    // Try login instead — user might already exist
    await loginTestUser(page);
    return;
  }
}

export async function loginTestUser(page: Page): Promise<void> {
  await page.goto("/login");
  await page.getByRole("textbox", { name: "Email" }).fill(TEST_USER.email);
  await page
    .getByRole("textbox", { name: "Password" })
    .fill(TEST_USER.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL("**/dashboard");
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible({
    timeout: 10000,
  });
}

export async function ensureLoggedIn(page: Page): Promise<void> {
  const response = await page.request.get("/dashboard");
  if (response.url().includes("/login")) {
    await loginTestUser(page);
  }
}
