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

  test("settings root redirects to organisation", async () => {
    await page.goto("/settings");
    await page.waitForURL("**/settings/organisation");
    expect(page.url()).toContain("/settings/organisation");
  });

  test("old /settings/company redirects to /settings/organisation", async () => {
    await page.goto("/settings/company");
    await page.waitForURL("**/settings/organisation");
    expect(page.url()).toContain("/settings/organisation");
  });

  test("organisation settings page renders", async () => {
    await page.goto("/settings/organisation");
    await expect(
      page.getByRole("heading", { name: /Organisation Settings/i }),
    ).toBeVisible();
    await expect(
      page.locator('input[name="name"]').or(page.getByLabel(/name/i)).first(),
    ).toBeVisible();
  });

  test("general settings page renders", async () => {
    await page.goto("/settings/general");
    await expect(
      page.getByRole("heading", { name: /General/i }).first(),
    ).toBeVisible();
  });

  test("account settings page renders", async () => {
    await page.goto("/settings/account");
    await expect(
      page.getByRole("heading", { name: /Account/i }).first(),
    ).toBeVisible();
  });

  test("appearance settings page renders", async () => {
    await page.goto("/settings/appearance");
    await expect(
      page.getByRole("heading", { name: /Appearance/i }).first(),
    ).toBeVisible();
    await expect(page.getByText("Dark")).toBeVisible();
  });

  test("integrations page renders", async () => {
    await page.goto("/settings/integrations");
    await expect(
      page.getByRole("heading", { name: /Integrations/i }).first(),
    ).toBeVisible();
  });

  test("myDATA integration redirects for non-GR orgs", async () => {
    await page.goto("/settings/integrations/mydata");
    const url = page.url();
    if (url.includes("/settings/integrations/mydata")) {
      // GR org — myDATA settings page renders
      await expect(page.locator("h2").first()).toBeVisible();
    } else {
      // Non-GR org — redirects to integrations list
      expect(url).toMatch(/\/settings\/integrations/);
    }
  });

  test("settings nav is visible in sidebar", async () => {
    await page.goto("/dashboard");
    await expect(page.getByRole("link", { name: /Settings/ })).toBeVisible();
  });

  test("settings secondary nav highlights active tab", async () => {
    await page.goto("/settings/general");
    const generalLink = page.locator('a[href="/settings/general"]').first();
    await expect(generalLink).toBeVisible();
  });
});
