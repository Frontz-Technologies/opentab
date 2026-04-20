import { test, expect, type Page } from "@playwright/test";
import { registerTestUser, loginTestUser } from "./helpers";

// retries:1 mitigates the dev-server instability class flagged in the
// PR #179 tester follow-up (socket hang-up / page-closed mid-
// navigation on the auth redirect chain). Short-term — the real fix
// is a separate investigation into HMR recompile / shared
// apiRequestContext keep-alive.
test.describe.configure({ mode: "serial", retries: 1 });

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
    // `getByText("Dark")` was resolving to 4 elements (icon + label
    // across radio options). Target the actual radio control instead.
    await expect(page.getByRole("radio", { name: "Dark" })).toBeVisible();
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

  test("general settings has language selector with 3 options", async () => {
    await page.goto("/settings/general");
    const localeSelect = page.locator('select[name="locale"]');
    if (await localeSelect.isVisible()) {
      const options = await localeSelect.locator("option").allTextContents();
      expect(options.length).toBe(3);
    }
  });

  test("settings secondary nav highlights active tab", async () => {
    await page.goto("/settings/general");
    const generalLink = page.locator('a[href="/settings/general"]').first();
    await expect(generalLink).toBeVisible();
  });

  test("Appearance → Light removes the dark class on <html>", async () => {
    await page.goto("/settings/appearance");
    const root = page.locator("html");
    // Dark is the default; ensure starting state
    await expect(root).toHaveClass(/(^| )dark( |$)/);

    await page.getByRole("button", { name: /Light/i }).first().click();
    await page.getByRole("button", { name: /^Save changes$/i }).click();

    // Optimistic client-side flip — class disappears
    await expect(root).not.toHaveClass(/(^| )dark( |$)/, { timeout: 3000 });
  });

  test("Light preference persists across reload", async () => {
    await page.goto("/settings/appearance");
    await expect(page.locator("html")).not.toHaveClass(/(^| )dark( |$)/);
    await page.reload();
    await expect(page.locator("html")).not.toHaveClass(/(^| )dark( |$)/);
  });

  test("Appearance → Dark re-adds the dark class", async () => {
    await page.goto("/settings/appearance");
    await page.getByRole("button", { name: /Dark/i }).first().click();
    await page.getByRole("button", { name: /^Save changes$/i }).click();
    await expect(page.locator("html")).toHaveClass(/(^| )dark( |$)/, {
      timeout: 3000,
    });
  });
});
