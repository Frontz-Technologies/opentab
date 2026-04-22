import { test, expect, type Page } from "@playwright/test";

const POPULATED_PAGES: { path: string; heading: string; minRows: number }[] = [
  { path: "/contacts", heading: "Contacts", minRows: 12 },
  { path: "/products", heading: "Products", minRows: 6 },
  { path: "/invoices", heading: "Invoices", minRows: 30 },
  { path: "/expenses", heading: "Expenses", minRows: 30 },
];

async function assertNoHorizontalOverflow(
  page: Page,
  label: string,
): Promise<void> {
  const { scrollWidth, clientWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  // Allow 1px sub-pixel rounding drift.
  expect(
    scrollWidth,
    `${label}: horizontal overflow (scrollWidth ${scrollWidth} > clientWidth ${clientWidth})`,
  ).toBeLessThanOrEqual(clientWidth + 1);
}

test.describe("Demo mode happy path", () => {
  // Cold-compile on the first visit to /contacts / /products / /invoices /
  // /expenses can each take 5–20 s on the Colima dev VM, and demo
  // provisioning adds another ~7 s. The default 60 s is tight when all
  // of that lands in a single test. See tester follow-up on PR #193
  // after SHA 1e8cba1.
  test.setTimeout(120_000);

  test("Try-Demo signs in and every list page is populated without overflow", async ({
    page,
  }) => {
    await page.goto("/login");

    // Demo card is gated on NEXT_PUBLIC_DEMO_SAMPLE_DATA_ENABLED — injected
    // via the webServer command in playwright.config.ts.
    await page.getByTestId("login-demo-card").waitFor();
    await page.getByRole("button", { name: /Try the demo/i }).click();

    await page.waitForURL("**/dashboard", { timeout: 30_000 });
    await expect(
      page.getByRole("heading", { name: "Dashboard" }),
    ).toBeVisible();

    // Dashboard KPI cards must not overflow their grid with realistic totals.
    await assertNoHorizontalOverflow(page, "/dashboard");

    for (const { path, heading, minRows } of POPULATED_PAGES) {
      await page.goto(path);
      await expect(page.getByRole("heading", { name: heading })).toBeVisible();

      // Populated list: rows can be <tbody tr>, data-testid*="row",
      // or role=listitem depending on the surface.
      const rowCount = await page
        .locator('[data-testid*="row"], tbody tr, [role="listitem"]')
        .count();
      expect(
        rowCount,
        `${path} should show at least ${minRows} populated rows, got ${rowCount}`,
      ).toBeGreaterThanOrEqual(minRows);

      await assertNoHorizontalOverflow(page, path);
    }
  });
});
