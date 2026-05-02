import { test, expect, type Page } from "@playwright/test";
import { registerTestUser, loginTestUser } from "./helpers";

// retries:1 mitigates a dev-server instability class (socket hang-up
// / page-closed mid-navigation on the auth redirect chain).
// Short-term — the real fix is a separate investigation into HMR
// recompile / shared apiRequestContext keep-alive.
test.describe.configure({ mode: "serial", retries: 1 });

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
    // the collapsed rail toggle it back explicitly; the
    // expanded-persistence test re-adds the same cookie.
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
    // `exact: true` prevents the matcher from also picking up the
    // empty-state "No contacts yet" h3. Same pattern as 02-contacts.
    await expect(
      page.getByRole("heading", { name: "Contacts", exact: true }),
    ).toBeVisible();

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
      page.getByRole("heading", { name: /^Good (morning|afternoon|evening),/ }),
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

test.describe("Sidebar / nav i18n + IA (PR-B)", () => {
  test.describe.configure({ mode: "serial" });
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    try {
      await registerTestUser(page);
    } catch {
      await loginTestUser(page);
    }
    // Expand the sidebar so group labels and the footer Settings label
    // are in the accessible name tree.
    await page
      .context()
      .addCookies([{ name: "sidebar_state", value: "true", url: page.url() }]);
  });

  test.afterAll(async () => {
    await page.close();
  });

  test("desktop sidebar shows Sales / Records / Insights labels", async () => {
    await page.goto("/dashboard");
    const sidebar = page.locator("aside, [data-slot='sidebar']").first();
    await expect(sidebar.getByText(/^SALES$/i)).toBeVisible();
    await expect(sidebar.getByText(/^RECORDS$/i)).toBeVisible();
    await expect(sidebar.getByText(/^INSIGHTS$/i)).toBeVisible();
  });

  test("settings link lives in the sidebar footer area", async () => {
    await page.goto("/dashboard");
    const sidebar = page.locator("aside, [data-slot='sidebar']").first();
    const settingsLink = sidebar.getByRole("link", { name: /^Settings$/i });
    await expect(settingsLink).toBeVisible();
    // Settings href must navigate.
    await settingsLink.click();
    await page.waitForURL("**/settings/**");
    expect(page.url()).toContain("/settings");
  });
});
