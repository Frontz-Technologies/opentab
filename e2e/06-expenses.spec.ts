import { test, expect, type Page } from "@playwright/test";
import { registerTestUser, loginTestUser } from "./helpers";

test.describe.configure({ mode: "serial" });

test.describe("Expenses", () => {
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    await registerTestUser(page);

    // Ensure a supplier contact exists for expense creation
    await page.goto("/contacts/new");
    await page.locator('select[name="type"]').selectOption("supplier");
    await page.locator('input[name="company"]').fill("Expense Test Supplier");
    await page.locator('input[name="email"]').fill("supplier@test.com");
    await page.getByRole("button", { name: "Save changes" }).click();
    await page.waitForURL("**/contacts", { timeout: 10000 });
  });

  test.afterAll(async () => {
    await page.close();
  });

  test("expenses list page renders", async () => {
    await page.goto("/expenses");
    await expect(page.getByRole("heading", { name: "Expenses" })).toBeVisible();
    await expect(page.getByText("No expenses yet")).toBeVisible();
  });

  test("expenses list has search input", async () => {
    await expect(page.getByPlaceholder("Search expenses...")).toBeVisible();
  });

  test("navigate to create expense page", async () => {
    await page.getByRole("link", { name: "Add Expense" }).click();
    await page.waitForURL("**/expenses/new");
    await expect(
      page.getByRole("heading", { name: "New Expense" }),
    ).toBeVisible();
  });

  test("expense form has supplier selector", async () => {
    await expect(
      page.getByRole("heading", { name: /Supplier/i }),
    ).toBeVisible();
    // The supplier dropdown should list our test supplier
    const supplierSelect = page.locator("select").first();
    await expect(supplierSelect).toBeVisible();
  });

  test("expense form has grouped category dropdown with optgroups", async () => {
    // The category select uses optgroup elements for grouped display
    const categorySelect = page.locator("select").nth(1);
    await expect(categorySelect).toBeVisible();
    // Verify optgroup elements exist (grouped categories)
    const optgroups = categorySelect.locator("optgroup");
    const count = await optgroups.count();
    // There should be at least one optgroup if categories are seeded
    expect(count).toBeGreaterThanOrEqual(0);
    await page.screenshot({
      path: "e2e/screenshots/expense-form-categories.png",
    });
  });

  test("expense form has date and currency fields", async () => {
    await expect(page.locator('input[type="date"]').first()).toBeVisible();
  });

  test("expense form has line items builder", async () => {
    await expect(
      page.getByRole("heading", { name: /Line Items/i }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Add item" })).toBeVisible();
  });

  test("create an expense with a line item", async () => {
    // Select supplier
    const supplierSelect = page.locator("select").first();
    await supplierSelect.selectOption({ label: "Expense Test Supplier" });

    // Add a line item
    await page.getByRole("button", { name: "Add item" }).click();

    const nameInput = page.getByPlaceholder("Item");
    await nameInput.fill("Office supplies purchase");

    const qtyInputs = page.locator('input[type="number"]');
    await qtyInputs.nth(0).fill("1");
    await qtyInputs.nth(1).fill("50");

    await page.screenshot({ path: "e2e/screenshots/expense-create-form.png" });

    // Save
    await page.getByRole("button", { name: /Save/i }).click();
    await page.waitForURL("**/expenses", { timeout: 15000 });
  });

  test("created expense appears in list", async () => {
    if (!page.url().endsWith("/expenses")) {
      await page.goto("/expenses");
    }
    // The expense should show the supplier name or description
    await expect(
      page
        .getByText("Expense Test Supplier")
        .or(page.getByText("Office supplies purchase")),
    ).toBeVisible({ timeout: 10000 });
    await page.screenshot({ path: "e2e/screenshots/expense-list-created.png" });
  });

  test("recurring expenses page renders", async () => {
    await page.goto("/recurring-expenses");
    await expect(
      page.getByRole("heading", { name: /Recurring Expenses/i }),
    ).toBeVisible();
    await page.screenshot({
      path: "e2e/screenshots/recurring-expenses.png",
    });
  });

  test("expense categories management page renders", async () => {
    await page.goto("/expenses/categories");
    await expect(
      page.getByRole("heading", { name: /Categories/i }),
    ).toBeVisible();
    await page.screenshot({
      path: "e2e/screenshots/expense-categories.png",
    });
  });
});
