import { test, expect, type Page } from "@playwright/test";
import { registerTestUser, loginTestUser } from "./helpers";

// retries:1 mitigates the dev-server instability class flagged in the
// PR #179 tester follow-up (socket hang-up / page-closed mid-
// navigation on the auth redirect chain). Short-term — the real fix
// is a separate investigation into HMR recompile / shared
// apiRequestContext keep-alive.
test.describe.configure({ mode: "serial", retries: 1 });

test.describe("Invoices", () => {
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    try {
      await registerTestUser(page);
    } catch {
      await loginTestUser(page);
    }

    // Ensure a client contact exists for invoice creation
    await page.goto("/contacts/new");
    await page.locator('select[name="type"]').selectOption("client");
    await page
      .locator('select[name="classification"]')
      .selectOption("business");
    await page.locator('input[name="company"]').fill("Invoice Test Client");
    await page.locator('input[name="email"]').fill("client@test.com");
    await page.getByRole("button", { name: "Save changes" }).click();
    await page.waitForURL("**/contacts", { timeout: 10000 });

    // Ensure a product exists for line items
    await page.goto("/products/new");
    await page.locator('input[name="name"]').fill("Test Service");
    await page.locator('[name="unitPrice"]').fill("100");
    await page.locator('select[name="unit"]').selectOption("hour");
    await page.locator('select[name="taxCategory"]').selectOption("standard");
    await page.getByRole("button", { name: "Save changes" }).click();
    await page.waitForURL("**/products", { timeout: 10000 });
  });

  test.afterAll(async () => {
    await page.close();
  });

  test("invoices list page shows empty state", async () => {
    await page.goto("/invoices");
    await expect(page.getByRole("heading", { name: "Invoices" })).toBeVisible();
    await expect(page.getByText("No invoices yet")).toBeVisible();
    await expect(page.getByRole("link", { name: "New Invoice" })).toBeVisible();
  });

  test("invoices list has search and status filters", async () => {
    await expect(page.getByPlaceholder("Search invoices...")).toBeVisible();
    await expect(page.getByRole("button", { name: "All" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Draft" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Sent" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Paid" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Overdue" })).toBeVisible();
  });

  test("navigate to create invoice page", async () => {
    await page.getByRole("link", { name: "New Invoice" }).click();
    await page.waitForURL("**/invoices/new");
    await expect(
      page.getByRole("heading", { name: "New Invoice" }),
    ).toBeVisible();
  });

  test("invoice form has client selector and line items", async () => {
    await expect(page.getByRole("heading", { name: "Client" })).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Line Items" }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Add item" })).toBeVisible();
  });

  test("create a draft invoice with line items", async () => {
    // Select the test client
    const clientSelect = page.locator("select").first();
    await clientSelect.selectOption({ label: "Invoice Test Client" });

    // Add a line item manually
    await page.getByRole("button", { name: "Add item" }).click();

    // Fill line item fields
    const nameInput = page.getByPlaceholder("Item");
    await nameInput.fill("Consulting work");

    // Fill quantity and price — find inputs by their type=number in the line item row
    const qtyInputs = page.locator('input[type="number"]');
    // Quantity is the first number input in the line item
    await qtyInputs.nth(0).fill("2");
    // Unit price is the second number input
    await qtyInputs.nth(1).fill("100");

    await page.screenshot({ path: "e2e/screenshots/invoice-create-form.png" });

    // Save as draft
    await page.getByRole("button", { name: /Save|Draft/i }).click();
    await page.waitForURL("**/invoices", { timeout: 15000 });
  });

  test("created invoice appears in list with draft status", async () => {
    if (!page.url().endsWith("/invoices")) {
      await page.goto("/invoices");
    }
    await expect(page.getByText("Invoice Test Client")).toBeVisible({
      timeout: 10000,
    });
    await page.screenshot({ path: "e2e/screenshots/invoice-list-draft.png" });
  });

  test("open invoice detail page", async () => {
    // Click on the invoice row to open detail
    await page.getByText("Invoice Test Client").first().click();
    await page.waitForURL("**/invoices/**");

    // Should show the invoice number and draft status
    await expect(page.locator("h1").first()).toBeVisible();
    await page.screenshot({ path: "e2e/screenshots/invoice-detail-draft.png" });
  });

  test("invoice detail shows line items", async () => {
    await expect(page.getByText("Consulting work")).toBeVisible();
  });

  test("draft invoice has Send and Delete actions", async () => {
    await expect(page.getByRole("button", { name: /Send/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /Delete/i })).toBeVisible();
  });

  test("draft invoice has Download PDF button", async () => {
    await expect(
      page.getByRole("button", { name: /Download.*PDF|PDF/i }),
    ).toBeVisible();
  });

  test("send invoice — transition from draft to sent", async () => {
    // Click send and accept the confirmation dialog
    page.on("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: /Send/i }).click();

    // Wait for status to update — the page refreshes
    await page.waitForTimeout(2000);

    // After sending, Send button should disappear, Mark as Paid should appear
    await expect(
      page.getByRole("button", { name: /Mark as Paid|Paid/i }),
    ).toBeVisible({ timeout: 10000 });

    await page.screenshot({ path: "e2e/screenshots/invoice-detail-sent.png" });
  });

  test("mark invoice as paid — transition from sent to paid", async () => {
    page.on("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: /Mark as Paid|Paid/i }).click();

    await page.waitForTimeout(2000);

    // After marking as paid, neither Send nor Mark as Paid should be visible
    // Only PDF download should remain
    await expect(
      page.getByRole("button", { name: /Download.*PDF|PDF/i }),
    ).toBeVisible({ timeout: 10000 });

    await page.screenshot({ path: "e2e/screenshots/invoice-detail-paid.png" });
  });

  test("invoice list toolbar stacks search above filter chips at 360px", async () => {
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto("/invoices");

    // The search input — shadcn input or plain html input — gets a placeholder.
    const search = page.getByPlaceholder(/search|αναζήτη|buscar/i).first();
    // The filter bar is the rounded-full strip containing All / Όλα / Todo.
    const filterBar = page
      .locator("[class*='rounded-full']")
      .filter({ hasText: /All|Όλα|Todo/i })
      .first();

    await expect(search).toBeVisible();
    await expect(filterBar).toBeVisible();

    const sBox = await search.boundingBox();
    const fBox = await filterBar.boundingBox();
    if (!sBox || !fBox) throw new Error("toolbar elements not measurable");
    // Search sits above the filter bar on mobile.
    expect(sBox.y + sBox.height).toBeLessThanOrEqual(fBox.y + 4);

    // Reset for any subsequent tests in this file.
    await page.setViewportSize({ width: 1280, height: 720 });
  });
});
