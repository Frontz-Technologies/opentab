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
    // Expand the sidebar so nav-link labels enter the accessible-name
    // tree; the first test clicks the Reports link via `getByRole`.
    // Same pattern used in 04-navigation.spec.ts.
    await page
      .context()
      .addCookies([{ name: "sidebar_state", value: "true", url: page.url() }]);
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
    // P&L is always unlocked. The previous regex `/P.*L/i` cross-matched
    // sidebar items (e.g. "Products" + "Invoices") and the two locked
    // report cards, blowing strict-mode. Pin to the exact accessible
    // name instead.
    await expect(
      page.getByRole("link", { name: "Profit & Loss", exact: true }),
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
    // PnlClient renders a DateRangePicker (button trigger) and presets.
    await expect(
      page.getByRole("button", { name: /date range/i }).first(),
    ).toBeVisible({
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
      // GR org — verify the DateRangePicker trigger renders
      await expect(
        page.getByRole("button", { name: /date range/i }).first(),
      ).toBeVisible();
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

  test("Reports tab strip does not wrap labels on a 360px viewport", async () => {
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto("/reports/pnl");

    const tabs = page.locator("a, button").filter({
      hasText:
        /^(Profit|VAT|Tax|Έσοδα|ΦΠΑ|Φορολογική|Ganancias|IVA|Proyección)/,
    });
    const heights = await tabs.evaluateAll((els) =>
      els.map((el) => el.getBoundingClientRect().height),
    );
    for (const h of heights) {
      // h-8 (32px) + py-1.5 padding = ~40px max single-line; wrapped ~52+.
      expect(h).toBeLessThan(44);
    }

    // Reset for any subsequent tests in this file.
    await page.setViewportSize({ width: 1280, height: 720 });
  });

  test('active Reports tab carries aria-current="page"', async () => {
    await page.setViewportSize({ width: 1200, height: 800 });
    await page.goto("/reports/pnl");
    // The active link in the Reports tab strip is the one with
    // aria-current="page". AnimatedFilterBar in link mode sets this on
    // the active item only, so exactly one match should exist.
    const activeTab = page.locator('a[aria-current="page"]').first();
    await expect(activeTab).toBeVisible();
    // The accessible name should be the P&L label in the active locale.
    const text = (await activeTab.textContent())?.trim();
    expect(text).toMatch(/Profit & Loss|Έσοδα & Έξοδα|Ganancias y pérdidas/);

    // Reset for any subsequent tests in this file.
    await page.setViewportSize({ width: 1280, height: 720 });
  });
});
