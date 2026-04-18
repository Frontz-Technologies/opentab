import { test, expect, type Page } from "@playwright/test";
import { registerTestUser, loginTestUser } from "./helpers";

test.describe.configure({ mode: "serial" });

test.describe("Reports", () => {
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

  test("reports page is accessible via sidebar", async () => {
    await page.goto("/dashboard");
    const sidebar = page.locator('[data-slot="sidebar"]');
    await expect(sidebar.getByRole("link", { name: /Reports/ })).toBeVisible();
    await sidebar.getByRole("link", { name: /Reports/ }).click();
    await page.waitForURL("**/reports");
  });

  test("reports index page renders with heading", async () => {
    await page.goto("/reports");
    await expect(page.getByRole("heading", { name: "Reports" })).toBeVisible();
    await page.screenshot({ path: "e2e/screenshots/reports-index.png" });
  });

  test("reports index shows all cards; regional ones link to settings when country unset", async () => {
    // P&L is always unlocked.
    await expect(
      page.getByRole("link", { name: /P.*L|Profit.*Loss/i }),
    ).toBeVisible();

    // VAT and Tax Projection cards are always rendered. When the org has no
    // country set they point at /settings/organisation (locked state);
    // when set they point at their own routes.
    const vat = page.getByRole("link", { name: /VAT/i });
    const tax = page.getByRole("link", { name: /Tax.*Projection/i });
    await expect(vat).toBeVisible();
    await expect(tax).toBeVisible();

    const vatHref = await vat.getAttribute("href");
    expect(vatHref).toMatch(/^(\/reports\/vat|\/settings\/organisation)$/);
    const taxHref = await tax.getAttribute("href");
    expect(taxHref).toMatch(
      /^(\/reports\/tax-projection|\/settings\/organisation)$/,
    );
  });

  test("P&L report page loads", async () => {
    await page.goto("/reports/pnl");
    // PnlClient renders date inputs and a generate button
    await expect(page.locator('input[type="date"]').first()).toBeVisible({
      timeout: 10000,
    });
    await page.screenshot({ path: "e2e/screenshots/reports-pnl.png" });
  });

  test("P&L report has period preset buttons", async () => {
    // The PnlClient renders month/quarter/year preset buttons
    await expect(
      page.locator("button").filter({ hasText: /Month/i }),
    ).toBeVisible();
    await expect(
      page.locator("button").filter({ hasText: /Quarter/i }),
    ).toBeVisible();
    await expect(
      page.locator("button").filter({ hasText: /Year/i }),
    ).toBeVisible();
  });

  test("VAT report page loads (or redirects if not GR org)", async () => {
    await page.goto("/reports/vat");
    // For non-GR orgs, this will redirect back to /reports
    // For GR orgs, it shows the VAT report with date inputs
    const url = page.url();
    if (url.includes("/reports/vat")) {
      // GR org — verify date inputs render
      await expect(page.locator('input[type="date"]').first()).toBeVisible();
      // Quarter buttons Q1-Q4
      await expect(
        page.locator("button").filter({ hasText: "Q1" }),
      ).toBeVisible();
      await page.screenshot({ path: "e2e/screenshots/reports-vat.png" });
    } else {
      // Non-GR org — should redirect to /reports
      expect(url).toMatch(/\/reports$/);
    }
  });

  test("tax projection page loads (or redirects if not GR org)", async () => {
    await page.goto("/reports/tax-projection");
    const url = page.url();
    if (url.includes("/reports/tax-projection")) {
      // GR org — page renders
      await expect(page.locator("h2").first()).toBeVisible();
      await page.screenshot({
        path: "e2e/screenshots/reports-tax-projection.png",
      });
    } else {
      // Non-GR org — should redirect to /reports
      expect(url).toMatch(/\/reports$/);
    }
  });
});
