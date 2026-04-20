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
    // Expand the sidebar so nav-link labels are in the accessible name
    // tree. The sidebar defaults to icon-collapsed, which strips label
    // spans (`group-data-[collapsible=icon]:hidden`) and breaks
    // `getByRole("link", { name: /Dashboard/ })`. Tests that require
    // the collapsed rail (68) toggle it back explicitly; the expanded-
    // persistence test (91) re-adds the same cookie. See #179 tester
    // follow-up.
    await page
      .context()
      .addCookies([{ name: "sidebar_state", value: "true", url: page.url() }]);
  });

  test.afterAll(async () => {
    await page.close();
  });

  test("sidebar shows all nav items", async () => {
    await page.goto("/dashboard");
    const sidebar = page.locator('[data-slot="sidebar"]');
    await expect(
      sidebar.getByRole("link", { name: /Dashboard/ }),
    ).toBeVisible();
    await expect(sidebar.getByRole("link", { name: /Invoices/ })).toBeVisible();
    await expect(sidebar.getByRole("link", { name: /Expenses/ })).toBeVisible();
    await expect(sidebar.getByRole("link", { name: /Contacts/ })).toBeVisible();
    await expect(sidebar.getByRole("link", { name: /Products/ })).toBeVisible();
    await expect(sidebar.getByRole("link", { name: /Reports/ })).toBeVisible();
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

    await sidebar.getByRole("link", { name: /Reports/ }).click();
    await page.waitForURL("**/reports");
    await expect(page.getByRole("heading", { name: "Reports" })).toBeVisible();

    await sidebar.getByRole("link", { name: /Dashboard/ }).click();
    await page.waitForURL("**/dashboard");
    await expect(
      page.getByRole("heading", { name: "Dashboard" }),
    ).toBeVisible();
  });

  test("settings page is accessible", async () => {
    await page.getByRole("link", { name: /Settings/ }).click();
    await page.waitForURL("**/settings/company");
    await expect(
      page.getByRole("heading", { name: "Company Information" }),
    ).toBeVisible();
  });

  test("collapsed sidebar shows tooltip for nav icon on hover", async () => {
    await page.goto("/dashboard");
    const sidebar = page.locator('[data-slot="sidebar"][data-state]');
    // Ensure the rail is collapsed (the default).
    const state = await sidebar.getAttribute("data-state");
    if (state !== "collapsed") {
      await page
        .locator('[data-slot="sidebar-trigger"], [data-sidebar="trigger"]')
        .first()
        .click();
      await expect(sidebar).toHaveAttribute("data-state", "collapsed");
    }

    await sidebar.getByRole("link", { name: /Invoices/ }).hover();
    const tooltip = page
      .locator('[data-slot="tooltip-content"]')
      .filter({ hasText: /^Invoices$/ });
    await expect(tooltip).toBeVisible({ timeout: 2000 });

    await page.mouse.move(0, 0);
    await expect(tooltip).toBeHidden({ timeout: 2000 });
  });

  test("sidebar expanded state persists across navigation and reload", async ({
    context,
  }) => {
    await context.addCookies([
      {
        name: "sidebar_state",
        value: "true",
        url: page.url(),
      },
    ]);

    await page.goto("/dashboard");
    const sidebar = page.locator('[data-slot="sidebar"][data-state]');
    await expect(sidebar).toHaveAttribute("data-state", "expanded");

    await page.goto("/contacts");
    await expect(sidebar).toHaveAttribute("data-state", "expanded");

    await page.reload();
    await expect(sidebar).toHaveAttribute("data-state", "expanded");
  });

  test("unknown route renders styled 404 inside the app shell", async () => {
    await page.goto("/totally-fake-route");
    // App shell still present
    await expect(page.locator('[data-slot="sidebar"]')).toBeVisible();
    // Headline visible (in current locale — asserts on EN copy)
    await expect(
      page.getByRole("heading", { name: /lost your way/i }),
    ).toBeVisible();
    // Single primary action leading back to dashboard
    await expect(
      page.getByRole("link", { name: /Back to Dashboard/i }),
    ).toBeVisible();
  });
});
