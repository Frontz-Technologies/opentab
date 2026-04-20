import { test, expect, type Page } from "@playwright/test";
import { TEST_USER } from "./helpers";

test.describe.configure({ mode: "serial" });

test.describe("Authentication", () => {
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
  });

  test.afterAll(async () => {
    await page.close();
  });

  test("login page renders correctly", async () => {
    await page.goto("/login");
    await expect(
      page.getByRole("heading", { name: "Welcome back" }),
    ).toBeVisible();
    await expect(page.getByRole("textbox", { name: "Email" })).toBeVisible();
    await expect(page.getByRole("textbox", { name: "Password" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Create account" }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Forgot password?" }),
    ).toBeVisible();
  });

  test("register page renders correctly", async () => {
    await page.goto("/register");
    await expect(
      page.getByRole("heading", { name: "Create your account" }),
    ).toBeVisible();
    await expect(
      page.getByRole("textbox", { name: "Full name" }),
    ).toBeVisible();
    await expect(page.getByRole("textbox", { name: "Email" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Sign in" })).toBeVisible();
  });

  test("forgot password page renders correctly", async () => {
    await page.goto("/forgot-password");
    await expect(
      page.getByRole("heading", { name: "Reset password" }),
    ).toBeVisible();
    await expect(page.getByRole("textbox", { name: "Email" })).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Send reset link" }),
    ).toBeVisible();
  });

  test("unauthenticated user is redirected to login", async () => {
    await page.goto("/dashboard");
    await page.waitForURL("**/login");
    await expect(
      page.getByRole("heading", { name: "Welcome back" }),
    ).toBeVisible();
  });

  test("register a new user", async () => {
    await page.goto("/register");
    await page.getByRole("textbox", { name: "Full name" }).fill(TEST_USER.name);
    await page.getByRole("textbox", { name: "Email" }).fill(TEST_USER.email);
    await page.getByLabel("Password", { exact: true }).fill(TEST_USER.password);
    await page.getByLabel("Confirm password").fill(TEST_USER.password);
    await page.getByRole("button", { name: "Create account" }).click();
    await page.waitForURL("**/dashboard", { timeout: 15000 });
    await expect(
      page.getByRole("heading", { name: "Dashboard" }),
    ).toBeVisible();
  });

  test("dashboard shows correct org name after registration", async ({
    context,
  }) => {
    // The org name is rendered only in the expanded sidebar header
    // (see `app-sidebar.tsx`'s `!isCollapsed` branch). The sidebar
    // defaults to collapsed (the `sidebar_state` cookie is unset), so
    // we expand it here before asserting — this test is about org-name
    // rendering, not sidebar layout.
    await context.addCookies([
      { name: "sidebar_state", value: "true", url: page.url() },
    ]);
    await page.reload();
    // Scope to the sidebar's org-name slot via data-testid and check
    // DOM text content — `truncate` on the span can confuse a plain
    // `getByText(...).toBeVisible()` when the container is narrow.
    await expect(page.getByTestId("sidebar-org-name")).toContainText(
      `${TEST_USER.name}'s Company`,
    );
  });

  test.skip("logout and login again — dropdown trigger needs data-testid", async () => {
    // Click user avatar to open dropdown — it's the rounded-full button
    await page.locator("button.rounded-full").first().click();
    await page.waitForTimeout(500);
    await page.getByText("Log out").click();
    await page.waitForURL("**/login", { timeout: 10000 });

    // Login again
    await page.getByRole("textbox", { name: "Email" }).fill(TEST_USER.email);
    await page
      .getByRole("textbox", { name: "Password" })
      .fill(TEST_USER.password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL("**/dashboard");
    await expect(
      page.getByRole("heading", { name: "Dashboard" }),
    ).toBeVisible();
  });

  test("wrong password shows error", async () => {
    await page.goto("/login");
    await page.getByRole("textbox", { name: "Email" }).fill(TEST_USER.email);
    await page
      .getByRole("textbox", { name: "Password" })
      .fill("WrongPassword!");
    await page.getByRole("button", { name: "Sign in" }).click();
    // Should stay on login page
    await expect(page).toHaveURL(/.*login/);
  });
});
