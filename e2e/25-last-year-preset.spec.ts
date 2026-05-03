import { test, expect, type Page } from "@playwright/test";
import { registerTestUser, loginTestUser } from "./helpers";

test.describe.configure({ mode: "serial" });

test.describe("Last Year preset", () => {
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

  test("PnL report has a Last Year preset button", async () => {
    await page.goto("/reports/pnl");
    const btn = page.getByRole("button", {
      name: /last year|πέρυσι|año pasado/i,
    });
    await expect(btn).toBeVisible();
    await btn.click();
  });
});
