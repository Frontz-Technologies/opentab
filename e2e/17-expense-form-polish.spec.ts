import { test, expect, type Page } from "@playwright/test";
import { registerTestUser } from "./helpers";

test.describe.configure({ mode: "serial", retries: 1 });

test.describe("Expense form polish (#252)", () => {
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    await registerTestUser(page);
  });

  test.afterAll(async () => {
    await page.close();
  });

  test("clear-all button is disabled while the form is pristine", async () => {
    await page.goto("/expenses/new");
    const clearAll = page.getByRole("button", { name: "Clear all" });
    await expect(clearAll).toBeVisible();
    await expect(clearAll).toBeDisabled();
  });

  test("clear-all opens an in-app confirm dialog and resets fields on Discard", async () => {
    // Fill the supplier-name + supplier invoice number to mark the form dirty.
    await page.locator('input[name="supplierName"]').fill("Acme Test");
    await page
      .locator('input[name="supplierInvoiceNumber"]')
      .fill("INV-2026-001");

    const clearAll = page.getByRole("button", { name: "Clear all" });
    await expect(clearAll).toBeEnabled();
    await clearAll.click();

    // Confirm dialog from the design system, not native confirm().
    await expect(
      page.getByRole("heading", { name: "Clear everything?" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Discard" }).click();

    // Fields cleared after confirm.
    await expect(page.locator('input[name="supplierName"]')).toHaveValue("");
    await expect(
      page.locator('input[name="supplierInvoiceNumber"]'),
    ).toHaveValue("");
  });

  test("unsaved-changes navigation guard renders the in-app modal, not a native confirm", async () => {
    // Make the form dirty again.
    await page.locator('input[name="supplierName"]').fill("Dirty supplier");

    // Sidebar lives outside the form. Clicking a sidebar link should be
    // intercepted by the UnsavedChangesGuard component.
    const sidebar = page.locator('[data-slot="sidebar"]');
    const dashboardLink = sidebar.getByRole("link", { name: /Dashboard/ });
    await dashboardLink.click();

    await expect(
      page.getByRole("heading", { name: "Discard unsaved changes?" }),
    ).toBeVisible();

    // Cancel keeps the user on /expenses/new, dirty state intact.
    await page.getByRole("button", { name: "Cancel" }).click();
    await expect(page).toHaveURL(/\/expenses\/new/);
    await expect(page.locator('input[name="supplierName"]')).toHaveValue(
      "Dirty supplier",
    );
  });

  // Receipt-extraction inline preview state (#253). Skipped — tracked in #256.
  // Unblock requires either e2e/fixtures/sample-receipt.pdf + Gemini key in
  // the e2e dev-server stack, or a page.route() mock for the upload Server
  // Action returning a canned UploadReceiptResult. State-transition logic
  // is fully covered by the Vitest suite at
  // apps/web/__tests__/extraction-preview-state.test.ts (13 tests).

  test.skip("Apply commits the AI receipt-extraction preview", async () => {
    await page.goto("/expenses/new");
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles("e2e/fixtures/sample-receipt.pdf");
    await page
      .getByText(/we found data|autofill/i)
      .waitFor({ state: "visible", timeout: 30000 });

    const supplierField = page.locator('input[name="supplierName"]');
    const supplierWrapper = supplierField.locator("..");
    await expect(supplierWrapper).toHaveClass(/bg-primary\/10/);

    await page.getByRole("button", { name: /apply/i }).click();

    await expect(supplierWrapper).not.toHaveClass(/bg-primary\/10/);
    await expect(supplierField).not.toHaveValue("");
  });

  test.skip("Discard reverts the AI receipt-extraction preview", async () => {
    await page.goto("/expenses/new");
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles("e2e/fixtures/sample-receipt.pdf");
    await page
      .getByText(/we found data|autofill/i)
      .waitFor({ state: "visible", timeout: 30000 });

    const supplierField = page.locator('input[name="supplierName"]');

    await page.getByRole("button", { name: /(discard|ignore)/i }).click();

    await expect(supplierField).toHaveValue("");
    await expect(page.locator(".bg-primary\\/10")).toHaveCount(0);
  });

  test.skip("single-field edit exits one preview without committing rest", async () => {
    await page.goto("/expenses/new");
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles("e2e/fixtures/sample-receipt.pdf");
    await page
      .getByText(/we found data|autofill/i)
      .waitFor({ state: "visible", timeout: 30000 });

    const supplierField = page.locator('input[name="supplierName"]');
    const supplierWrapper = supplierField.locator("..");
    const dateField = page.locator('input[name="expenseDate"]');
    const dateWrapper = dateField.locator("..");

    await expect(supplierWrapper).toHaveClass(/bg-primary\/10/);
    await expect(dateWrapper).toHaveClass(/bg-primary\/10/);

    await supplierField.fill("Manual override");

    await expect(supplierWrapper).not.toHaveClass(/bg-primary\/10/);
    await expect(dateWrapper).toHaveClass(/bg-primary\/10/);

    await page.getByRole("button", { name: /apply/i }).click();
    await expect(supplierField).toHaveValue("Manual override");
  });
});
