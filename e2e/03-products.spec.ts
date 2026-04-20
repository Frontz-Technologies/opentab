import { test, expect, type Page } from "@playwright/test";
import { registerTestUser, loginTestUser } from "./helpers";

// retries:1 mitigates the dev-server instability class flagged in the
// PR #179 tester follow-up (socket hang-up / page-closed mid-
// navigation on the auth redirect chain). Short-term — the real fix
// is a separate investigation into HMR recompile / shared
// apiRequestContext keep-alive.
test.describe.configure({ mode: "serial", retries: 1 });

test.describe("Products", () => {
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

  test("products list page shows empty state", async () => {
    await page.goto("/products");
    await expect(
      page.getByRole("heading", { name: "Products & Services" }),
    ).toBeVisible();
    await expect(page.getByText("No products yet")).toBeVisible();
    await expect(page.getByRole("link", { name: "Add Product" })).toBeVisible();
  });

  test("products list has search and inactive toggle", async () => {
    await expect(page.getByPlaceholder("Search products...")).toBeVisible();
    await expect(page.getByText("Show inactive")).toBeVisible();
  });

  test("navigate to create product page", async () => {
    await page.getByRole("link", { name: "Add Product" }).click();
    await page.waitForURL("**/products/new");
    await expect(
      page.getByRole("heading", { name: "Add Product" }),
    ).toBeVisible();
  });

  test("product form has all required fields", async () => {
    await expect(page.locator('input[name="name"]')).toBeVisible();
    await expect(page.locator('textarea[name="description"]')).toBeVisible();
    await expect(page.locator('[name="unitPrice"]')).toBeVisible();
    await expect(page.locator('select[name="unit"]')).toBeVisible();
    await expect(page.locator('select[name="taxCategory"]')).toBeVisible();
  });

  test("unit dropdown has correct options", async () => {
    const unitSelect = page.locator('select[name="unit"]');
    const options = unitSelect.locator("option");
    await expect(options).toHaveCount(6); // item, hour, day, service, kg, unit
  });

  test("tax category dropdown has correct options", async () => {
    const taxSelect = page.locator('select[name="taxCategory"]');
    const options = taxSelect.locator("option");
    await expect(options).toHaveCount(6); // standard, reduced, super_reduced, zero_rated, exempt, reverse_charge
  });

  test("create a product", async () => {
    await page.locator('input[name="name"]').fill("Web Development");
    await page
      .locator('textarea[name="description"]')
      .fill("Hourly web development services");
    await page.locator('[name="unitPrice"]').fill("85");
    await page.locator('select[name="unit"]').selectOption("hour");
    await page.locator('select[name="taxCategory"]').selectOption("standard");

    await page.getByRole("button", { name: "Save changes" }).click();
    await page.waitForURL("**/products", { timeout: 10000 });
  });

  test("created product appears in list", async () => {
    if (!page.url().endsWith("/products")) {
      await page.goto("/products");
    }
    await expect(
      page.getByRole("link", { name: "Web Development" }),
    ).toBeVisible({ timeout: 10000 });
    await expect(page.getByText("85.00")).toBeVisible();
    await expect(
      page.getByRole("cell", { name: "hour", exact: true }),
    ).toBeVisible();
  });

  test("create a second product", async () => {
    await page.getByRole("link", { name: "Add Product" }).click();
    await page.waitForURL("**/products/new");

    await page.locator('input[name="name"]').fill("Monthly Hosting");
    await page
      .locator('textarea[name="description"]')
      .fill("Cloud hosting subscription");
    await page.locator('[name="unitPrice"]').fill("29.99");
    await page.locator('select[name="unit"]').selectOption("service");
    await page.locator('select[name="taxCategory"]').selectOption("standard");

    await page.getByRole("button", { name: "Save changes" }).click();
    await page.waitForURL("**/products", { timeout: 10000 });
  });

  test("both products appear in list", async () => {
    await expect(
      page.getByRole("link", { name: "Web Development" }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Monthly Hosting" }),
    ).toBeVisible();
  });

  test("search products by name", async () => {
    await page.getByPlaceholder("Search products...").fill("Hosting");
    await expect(page.getByText("Monthly Hosting")).toBeVisible();
    await expect(page.getByText("Web Development")).not.toBeVisible();
    await page.getByPlaceholder("Search products...").clear();
  });

  test("edit product - page loads with data", async () => {
    await page.getByRole("link", { name: "Web Development" }).click();
    await page.waitForURL("**/products/**");
    await expect(
      page.getByRole("heading", { name: "Edit Product" }),
    ).toBeVisible();
    await expect(page.locator('input[name="name"]')).toHaveValue(
      "Web Development",
    );
    await expect(page.locator('[name="unitPrice"]')).toHaveValue("85.00");
  });
});
