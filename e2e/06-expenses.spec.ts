import { test, expect, type Page } from "@playwright/test";
import { registerTestUser, loginTestUser } from "./helpers";

test.describe.configure({ mode: "serial" });

test.describe("Expenses", () => {
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    await registerTestUser(page);
  });

  test.afterAll(async () => {
    await page.close();
  });

  test("expenses list page renders", async () => {
    await page.goto("/expenses");
    await expect(page.getByRole("heading", { name: "Expenses" })).toBeVisible();
    await expect(page.getByText("No expenses yet")).toBeVisible();
  });

  test("expenses list has search and status filters", async () => {
    await expect(page.getByPlaceholder("Search expenses...")).toBeVisible();
    await expect(page.getByRole("button", { name: "All" })).toBeVisible();
  });

  test("navigate to create expense page", async () => {
    await page.getByRole("link", { name: "Add Expense" }).click();
    await page.waitForURL("**/expenses/new");
    await expect(
      page.getByRole("heading", { name: "New Expense" }),
    ).toBeVisible();
  });

  test("expense form has required sections", async () => {
    // Should have supplier selector, category, date, amount fields
    await expect(page.locator('select[name="categoryId"]')).toBeVisible();
    await expect(page.getByRole("button", { name: "Save" })).toBeVisible();
  });

  test("recurring expenses page renders", async () => {
    await page.goto("/recurring-expenses");
    await expect(
      page.getByRole("heading", { name: /Recurring Expenses/i }),
    ).toBeVisible();
  });

  test("expense categories management page renders", async () => {
    await page.goto("/expenses/categories");
    await expect(
      page.getByRole("heading", { name: /Categories/i }),
    ).toBeVisible();
  });
});
