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

  test("reports index shows all three report cards for GR org", async () => {
    // Newly-registered users default to countryCode "GR" (see auth-server.ts),
    // so the reports overview must show P&L, VAT, and Tax Projection.
    await expect(
      page.getByRole("link", { name: /P.*L|Profit.*Loss/i }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: /VAT/i })).toBeVisible();
    await expect(
      page.getByRole("link", { name: /Tax.*Projection/i }),
    ).toBeVisible();
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

  test("VAT report page loads for GR org", async () => {
    await page.goto("/reports/vat");
    expect(page.url()).toContain("/reports/vat");
    await expect(page.locator('input[type="date"]').first()).toBeVisible();
    await expect(
      page.locator("button").filter({ hasText: "Q1" }),
    ).toBeVisible();
    await page.screenshot({ path: "e2e/screenshots/reports-vat.png" });
  });

  test("tax projection page loads for GR org", async () => {
    await page.goto("/reports/tax-projection");
    expect(page.url()).toContain("/reports/tax-projection");
    await expect(page.locator("h2").first()).toBeVisible();
    await page.screenshot({
      path: "e2e/screenshots/reports-tax-projection.png",
    });
  });
});
