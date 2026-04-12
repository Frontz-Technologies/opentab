import { test, expect, type Page } from "@playwright/test";
import { registerTestUser, loginTestUser } from "./helpers";

test.describe.configure({ mode: "serial" });

test.describe("Invoices", () => {
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    try {
      await registerTestUser(page);
    } catch {
      await loginTestUser(page);
    }
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
    await expect(page.getByText("Select a client")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Line Items" }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Add item" })).toBeVisible();
  });

  test("can add a line item", async () => {
    await page.getByRole("button", { name: "Add item" }).click();
    // Verify line item fields appear
    await expect(page.getByPlaceholder("Item")).toBeVisible();
  });
});
