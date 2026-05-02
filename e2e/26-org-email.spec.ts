import { test, expect, type Page } from "@playwright/test";
import { registerTestUser, loginTestUser } from "./helpers";

test.describe.configure({ mode: "serial" });

test.describe("Organisation contact email (#285)", () => {
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    try {
      await registerTestUser(page);
    } catch {
      await loginTestUser(page);
    }
  });

  test.afterAll(async () => {
    await page.close();
  });

  test("settings/organisation persists a contact email", async () => {
    await page.goto("/settings/organisation");
    const emailInput = page.locator('input[name="email"]');
    await emailInput.fill("ops@example-org.test");
    await page.getByRole("button", { name: /save/i }).click();
    await page.reload();
    await expect(page.locator('input[name="email"]')).toHaveValue(
      "ops@example-org.test",
    );
  });
});
