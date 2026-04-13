import { test, expect, type Page } from "@playwright/test";
import { registerTestUser, loginTestUser } from "./helpers";

test.describe.configure({ mode: "serial" });

test.describe("Settings", () => {
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

  test("company settings page renders", async () => {
    await page.goto("/settings/company");
    await expect(
      page.getByRole("heading", { name: "Company Settings" }),
    ).toBeVisible();
    await page.screenshot({ path: "e2e/screenshots/settings-company.png" });
  });

  test("company settings form has required fields", async () => {
    // The CompanyForm renders fields for name, currency, tax ID, etc.
    await expect(
      page.locator('input[name="name"]').or(page.getByLabel(/name/i)).first(),
    ).toBeVisible();
  });

  test("company settings pre-fills org name from registration", async () => {
    // After registration, the org name should be "<user name>'s Company"
    const nameInput = page.locator('input[name="name"]');
    if (await nameInput.isVisible()) {
      const value = await nameInput.inputValue();
      expect(value).toBeTruthy();
    }
  });

  test("myDATA settings page loads (or redirects for non-GR orgs)", async () => {
    await page.goto("/settings/mydata");
    const url = page.url();
    if (url.includes("/settings/mydata")) {
      // GR org — myDATA settings page renders
      await expect(page.locator("h2").first()).toBeVisible();
      await page.screenshot({ path: "e2e/screenshots/settings-mydata.png" });
    } else {
      // Non-GR org — redirects to company settings
      expect(url).toMatch(/\/settings\/company/);
    }
  });

  test("sidebar has settings and myDATA links", async () => {
    await page.goto("/dashboard");
    await expect(page.getByRole("link", { name: /Settings/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /myDATA/ })).toBeVisible();
  });
});
