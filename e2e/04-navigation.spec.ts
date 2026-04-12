import { test, expect, type Page } from "@playwright/test";
import { registerTestUser, loginTestUser } from "./helpers";

test.describe.configure({ mode: "serial" });

test.describe("Navigation", () => {
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

  test("sidebar shows all nav items", async () => {
    await page.goto("/dashboard");
    const sidebar = page.locator('[data-slot="sidebar"]');
    await expect(sidebar.getByRole("link", { name: /Dashboard/ })).toBeVisible();
    await expect(sidebar.getByRole("link", { name: /Invoices/ })).toBeVisible();
    await expect(sidebar.getByRole("link", { name: /Expenses/ })).toBeVisible();
    await expect(sidebar.getByRole("link", { name: /Contacts/ })).toBeVisible();
    await expect(sidebar.getByRole("link", { name: /Products/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /Settings/ })).toBeVisible();
  });

  test("navigate between pages via sidebar", async () => {
    const sidebar = page.locator('[data-slot="sidebar"]');

    await sidebar.getByRole("link", { name: /Contacts/ }).click();
    await page.waitForURL("**/contacts");
    await expect(page.getByRole("heading", { name: "Contacts" })).toBeVisible();

    await sidebar.getByRole("link", { name: /Products/ }).click();
    await page.waitForURL("**/products");
    await expect(
      page.getByRole("heading", { name: "Products & Services" }),
    ).toBeVisible();

    await sidebar.getByRole("link", { name: /Dashboard/ }).click();
    await page.waitForURL("**/dashboard");
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  });

  test("settings page is accessible", async () => {
    await page.getByRole("link", { name: /Settings/ }).click();
    await page.waitForURL("**/settings/company");
    await expect(
      page.getByRole("heading", { name: "Company Information" }),
    ).toBeVisible();
  });
});
