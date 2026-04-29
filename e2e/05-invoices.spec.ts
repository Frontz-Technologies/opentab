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

  test("new-invoice form action row stacks vertically at 360px", async () => {
    await page.setViewportSize({ width: 360, height: 900 });
    await page.goto("/invoices/new");
    const draftBtn = page.getByRole("button", {
      name: /save draft|αποθήκευση πρόχειρου|guardar borrador/i,
    });
    const publishBtn = page.getByRole("button", {
      name: /^publish$|^δημοσίευση$|^publicar$/i,
    });
    await expect(draftBtn).toBeVisible();
    await expect(publishBtn).toBeVisible();
    const draftBox = await draftBtn.boundingBox();
    const publishBox = await publishBtn.boundingBox();
    if (!draftBox || !publishBox) throw new Error("CTA buttons not measurable");
    // Publish (primary) renders above Save draft on mobile.
    expect(publishBox.y).toBeLessThan(draftBox.y);
    expect(draftBox.width).toBeGreaterThan(360 - 64);
    expect(publishBox.width).toBeGreaterThan(360 - 64);
    await page.setViewportSize({ width: 1280, height: 720 });
  });

  test("new-invoice form: inclusive-tax toggle lives in the line-items section header", async () => {
    await page.goto("/invoices/new");
    const toggleLabel = page.getByText(
      /Prices include VAT|Οι τιμές περιλαμβάνουν ΦΠΑ|Los precios incluyen IVA/i,
    );
    await expect(toggleLabel).toBeVisible();
    // The toggle must NOT live in the form's top section near the currency selector.
    // Verify it sits inside the same scrollable region as the line-items table by
    // confirming it's vertically below the line-items heading.
    const itemsHeading = page
      .getByRole("heading", { level: 2 })
      .filter({ hasText: /items|προϊόντα|líneas/i })
      .first();
    const headingBox = await itemsHeading.boundingBox();
    const toggleBox = await toggleLabel.boundingBox();
    if (!headingBox || !toggleBox)
      throw new Error("can't measure heading/toggle");
    // Same row OR below the heading — never above it.
    expect(toggleBox.y).toBeGreaterThanOrEqual(headingBox.y - 4);
  });
});
