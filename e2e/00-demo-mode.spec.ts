import { test, expect, type Page } from "@playwright/test";

// minRows asserts the page is POPULATED, not that every seeded row is
// rendered. /invoices and /expenses paginate at ~25 per page despite the
// seed producing 48 / 70 rows respectively — keep the threshold below a
// single page's worth of data so this test isn't coupled to pagination
// internals. Exact seeded counts are asserted separately in
// __tests__/demo-populate.test.ts via assertPopulateResult.
const POPULATED_PAGES: { path: string; heading: string; minRows: number }[] = [
  { path: "/contacts", heading: "Contacts", minRows: 12 },
  { path: "/products", heading: "Products", minRows: 6 },
  { path: "/invoices", heading: "Invoices", minRows: 20 },
  { path: "/expenses", heading: "Expenses", minRows: 20 },
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
  // Cold-compile on the first visit to /dashboard, /contacts, /products,
  // /invoices, /expenses each cost 5–20 s on the Colima dev VM; demo
  // provisioning on a fresh DB adds another ~7 s. Bumped from 120 s to
  // 240 s after SHA 46c3695 hit the previous ceiling on /expenses.
  test.setTimeout(240_000);

  test("Try-Demo signs in and every list page is populated without overflow", async ({
    page,
  }) => {
    await page.goto("/login");

    // Demo card is gated on NEXT_PUBLIC_DEMO_SAMPLE_DATA_ENABLED — injected
    // via the webServer command in playwright.config.ts.
    await page.getByTestId("login-demo-card").waitFor();
    await page.getByRole("button", { name: /Try the demo/i }).click();

    // Generous budget — first-call populateOrgDemo takes up to ~10 s on
    // a fresh DB, the sign-in round-trip takes ~2–5 s, and /dashboard's
    // first compile is another ~10–15 s on cold dev.
    await page.waitForURL("**/dashboard", { timeout: 60_000 });
    await expect(
      page.getByRole("heading", { name: /^Good (morning|afternoon|evening),/ }),
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
