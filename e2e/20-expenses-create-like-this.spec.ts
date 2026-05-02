import { test, expect, type Page } from "@playwright/test";
import { registerTestUser, loginTestUser } from "./helpers";

test.describe.configure({ mode: "serial", retries: 1 });

test.describe("Expenses — Create like this", () => {
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    try {
      await registerTestUser(page);
    } catch {
      await loginTestUser(page);
    }

    // Seed a supplier contact so the source expense can reference it.
    await page.goto("/contacts/new");
    await page.locator('select[name="type"]').selectOption("supplier");
    await page.locator('input[name="company"]').fill("Clone-Source Supplier");
    await page.locator('input[name="email"]').fill("clone-src@test.com");
    await page.getByRole("button", { name: /Save changes/i }).click();
    await page.waitForURL("**/contacts", { timeout: 10000 });
  });

  test.afterAll(async () => {
    if (page) await page.close();
  });

  test("clones an expense, forces today's date, saves a second one", async () => {
    // 1. Create the source expense.
    await page.goto("/expenses/new");

    // Pick supplier (first <select> on the page).
    await page
      .locator("select")
      .first()
      .selectOption({ label: "Clone-Source Supplier" });

    // Pick a category (Combobox button).
    const categoryTrigger = page
      .getByRole("button", { name: /category|κατηγορία|categoría/i })
      .first();
    await categoryTrigger.click();
    await page.getByRole("option").first().click();

    // Add a line item.
    await page
      .getByRole("button", { name: /Add item|Προσθήκη|Añadir/i })
      .click();
    await page
      .getByPlaceholder(/^Item$|^Είδος$|^Artículo$/)
      .first()
      .fill("Cloud subscription");
    const numberInputs = page.locator('input[type="number"]');
    await numberInputs.nth(0).fill("1"); // qty
    await numberInputs.nth(1).fill("50"); // unit price

    // Save the source expense.
    await page.getByRole("button", { name: /^Save$/i }).click();
    await page.waitForURL(/\/expenses(\?|$|\/[^/]+$)/, { timeout: 10000 });

    // 2. Open the source detail page.
    if (!/\/expenses\/[a-z0-9-]+$/i.test(page.url())) {
      await page.goto("/expenses");
      await page
        .getByRole("link")
        .filter({ hasText: /Clone-Source Supplier/ })
        .first()
        .click();
    }
    await page.waitForURL(/\/expenses\/[a-z0-9-]+$/i, { timeout: 10000 });

    // 3. Click "Create like this".
    await page
      .getByRole("link", {
        name: /Create like this|Δημιουργία παρόμοιου|Crear similar/i,
      })
      .click();
    await page.waitForURL(/\/expenses\/new\?from=/, { timeout: 5000 });

    // 4. Form pre-seeded; expenseDate is today (NOT the source's date).
    const today = new Date().toISOString().slice(0, 10);
    // The expenseDate input is rendered via DatePicker which mirrors via a
    // hidden <input name="expenseDate"> for FormData round-trip.
    await expect(page.locator('input[name="expenseDate"]')).toHaveValue(today);

    // 5. Save the clone unmodified.
    await page.getByRole("button", { name: /^Save$/i }).click();
    await page.waitForURL(/\/expenses(\?|$|\/[^/]+$)/, { timeout: 10000 });

    // 6. List should have ≥ 2 rows referencing the supplier.
    await page.goto("/expenses");
    const rows = page
      .getByRole("link")
      .filter({ hasText: /Clone-Source Supplier/ });
    expect(await rows.count()).toBeGreaterThanOrEqual(2);
  });
});
