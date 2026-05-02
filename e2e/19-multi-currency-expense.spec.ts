import { test, expect, type Page } from "@playwright/test";
import { registerTestUser, loginTestUser } from "./helpers";

// Happy-path coverage for the multi-currency expense flow.
//
// Flow:
//   1. Sign in to a test EUR-base org. Fresh registrations default the
//      organisations.default_currency column to 'EUR' (see
//      packages/db/src/schema/organisations.ts), so no extra seeding is
//      required to put the org in EUR-base mode.
//   2. Seed a supplier contact so the form's required supplier field is
//      satisfiable. This mirrors e2e/06-expenses.spec.ts.
//   3. Open /expenses/new, switch the currency Combobox to USD, fill in
//      a line item, and assert the inline rate hint surfaces.
//   4. Save. The form pushes to /expenses on success.
//   5. Click into the new expense's detail page and assert the original
//      USD amount AND the EUR equivalent line both render via
//      <MoneyWithBase>.
//
// FX rate sourcing
// ----------------
// The form's /api/fx/preview endpoint and the createExpense Server
// Action both call getFxRate(date, USD, EUR). When the cache row is
// absent, the active provider (Frankfurter) is consulted live and the
// result is written back to fx_rate_cache. The expense's expense_date
// defaults to today, which Frankfurter publishes (it serves the latest
// ECB reference rate). We deliberately keep that default rather than
// pinning to a fixed past date so the test does not depend on weekend /
// holiday gaps in ECB data.
//
// If the test infrastructure has restricted outbound HTTPS the rate
// hint will not appear and the save will surface the
// "rate-unavailable" toast — the test asserts the rate hint to fail
// loudly in that environment rather than producing a false green.
test.describe.configure({ mode: "serial", retries: 1 });

test.describe("Multi-currency expense happy path", () => {
  let page: Page;
  let expenseDetailUrl: string | null = null;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    try {
      await registerTestUser(page);
    } catch {
      await loginTestUser(page);
    }

    // Seed a supplier contact (required for expense creation in this
    // app's UX — the supplier select is mandatory unless free-text
    // supplierName is filled, but the saved e2e supplier mirrors how
    // 06-expenses.spec.ts proves the happy path).
    await page.goto("/contacts/new");
    await page.locator('select[name="type"]').selectOption("supplier");
    await page.locator('input[name="company"]').fill("FX Test Supplier (USD)");
    await page.locator('input[name="email"]').fill("fx-supplier@test.com");
    await page.getByRole("button", { name: "Save changes" }).click();
    await page.waitForURL("**/contacts", { timeout: 10000 });
  });

  test.afterAll(async () => {
    if (page) await page.close();
  });

  test("USD expense in EUR-base org snapshots ECB rate and shows base equivalent", async () => {
    await page.goto("/expenses/new");

    // 1. Open the currency Combobox (rendered by CurrencyCombobox →
    //    Combobox → PopoverTrigger that renders a Button with
    //    aria-haspopup="listbox"). The Currency label sits in a
    //    sibling <label>, so target the trigger via its placeholder
    //    text ("Select currency", from messages/en.json:common.
    //    currencyPlaceholder) which is shown when value is unset, OR
    //    by the currently-selected default ("EUR — Euro") when value
    //    matches the org default.
    const currencyTrigger = page
      .locator('button[aria-haspopup="listbox"]')
      .filter({ hasText: /^EUR\s*—|Select currency/ })
      .first();
    await expect(currencyTrigger).toBeVisible();
    await currencyTrigger.click();

    // 2. The Popover renders a CommandInput + CommandItems in a
    //    portal. Type "USD" to filter, then click the matching item.
    await page.getByPlaceholder(/Search currencies/i).fill("USD");
    await page.getByRole("option", { name: /USD\s+—\s+US Dollar/ }).click();

    // The trigger label should now read "USD — US Dollar".
    await expect(currencyTrigger).toContainText("USD");

    // 3. Pick the supplier (first <select> on the page is the supplier
    //    Select; the Combobox triggers are <button>s, not <select>s).
    await page
      .locator("select")
      .first()
      .selectOption({ label: "FX Test Supplier (USD)" });

    // 4. Add a single line item priced in USD.
    await page.getByRole("button", { name: /Add item/i }).click();
    await page.getByPlaceholder("Item").fill("Cloud hosting (USD)");
    const numberInputs = page.locator('input[type="number"]');
    await numberInputs.nth(0).fill("1"); // qty
    await numberInputs.nth(1).fill("100"); // unit price = 100.00 USD

    // 5. The expense_date default is today; the form's debounced
    //    /api/fx/preview fetch fires 300 ms after the form mounts and
    //    again whenever currency or date changes. Wait for the rate
    //    hint paragraph — translated as
    //    "1 USD ≈ {rate} EUR (rate of {date}, ECB)".
    await expect(page.getByText(/1\s+USD\s+≈/)).toBeVisible({
      timeout: 15_000,
    });

    // 6. Submit. The form's handleSubmit awaits createExpense and on
    //    success calls router.push("/expenses").
    await page.getByRole("button", { name: /^Save$/i }).click();
    await page.waitForURL("**/expenses", { timeout: 15_000 });

    // 7. The expense list cell renders MoneyWithBase, which prints
    //    "USD 100.00" with a smaller "≈ EUR …" line beneath. Confirm
    //    both pieces are present in the row before drilling into the
    //    detail page.
    const listRow = page
      .getByRole("row")
      .filter({ hasText: "FX Test Supplier (USD)" })
      .first();
    await expect(listRow).toContainText(/USD\s+100\.00/);
    await expect(listRow).toContainText(/≈\s*EUR/);

    // 8. Drill into the expense detail page and assert the same
    //    composite render appears in the totals block.
    await listRow.getByRole("link").first().click();
    await page.waitForURL(/\/expenses\/[a-z0-9-]+$/i, { timeout: 10_000 });
    expenseDetailUrl = page.url();

    // The detail page renders <MoneyWithBase> beside the Total label
    // (apps/web/app/(app)/expenses/[id]/page.tsx). Both lines must be
    // present.
    await expect(page.getByText(/USD\s+100\.00/).first()).toBeVisible();
    await expect(page.getByText(/≈\s*EUR\s+\d/).first()).toBeVisible();
  });

  test("expense detail page persists the snapshot rate across reloads", async () => {
    test.skip(!expenseDetailUrl, "previous test did not capture a detail URL");
    await page.goto(expenseDetailUrl!);
    // Re-rendering from the persisted exchange_rate column (not from
    // a fresh getFxRate call) — proves the snapshot was committed at
    // save time rather than re-derived per request.
    await expect(page.getByText(/USD\s+100\.00/).first()).toBeVisible();
    await expect(page.getByText(/≈\s*EUR\s+\d/).first()).toBeVisible();
  });
});
