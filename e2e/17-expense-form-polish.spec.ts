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
});
