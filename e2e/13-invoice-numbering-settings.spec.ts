import { test, expect, type Page } from "@playwright/test";
import { registerTestUser, loginTestUser } from "./helpers";

// Smoke test: change the prefix in Settings, then create + publish
// an invoice, and assert the assigned number reflects the new
// prefix. Failure-surface coverage (placeholder grammar, schema
// validation) is in the unit tests:
//   apps/web/__tests__/invoicing-numbering-pattern.test.ts
//   apps/web/__tests__/invoicing-numbering-actions.test.ts
test.describe.configure({ mode: "serial", retries: 1 });

test.describe("Invoice numbering settings", () => {
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
    if (page) await page.close();
  });

  test("changing the prefix in Settings flows through to a published invoice's number", async () => {
    await page.goto("/settings/numbering");
    await page.getByLabel(/Prefix/i).fill("ACME-");
    await page
      .getByRole("button", { name: /Save numbering settings/i })
      .click();
    // Toast or page-stay both fine; just give the action a beat.
    await page.waitForLoadState("networkidle");

    // Live preview reflects the change.
    await expect(page.getByTestId("numbering-preview")).toContainText(/^ACME-/);

    // Seed minimum data: one client, one invoice, publish it.
    await page.goto("/contacts/new");
    await page.locator('select[name="type"]').selectOption("client");
    await page
      .locator('select[name="classification"]')
      .selectOption("business");
    await page.locator('input[name="company"]').fill("Numbering Test Client");
    await page.locator('input[name="email"]').fill("numbering-client@test.com");
    await page.getByRole("button", { name: "Save changes" }).click();
    await page.waitForURL("**/contacts", { timeout: 10000 });

    await page.goto("/invoices/new");
    await page
      .locator("select")
      .first()
      .selectOption({ label: "Numbering Test Client" });
    await page.getByRole("button", { name: "Add item" }).click();
    await page.getByPlaceholder("Item").fill("Numbering smoke item");
    const numberInputs = page.locator('input[type="number"]');
    await numberInputs.nth(0).fill("1");
    await numberInputs.nth(1).fill("60");
    await page.getByRole("button", { name: /Save|Draft/i }).click();
    await page.waitForURL("**/invoices", { timeout: 15000 });

    await page.getByText("Numbering Test Client").first().click();
    await page.waitForURL(/\/invoices\/[a-z0-9-]+/i, { timeout: 10000 });

    // Publish if the action is exposed; otherwise the invoice already
    // has a number from creation.
    const publishBtn = page.getByRole("button", { name: /^Publish/i });
    if (await publishBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
      page.on("dialog", (d) => d.accept());
      await publishBtn.click();
      await page.waitForLoadState("networkidle");
    }

    // The list should now show a number starting with ACME-.
    await page.goto("/invoices");
    await expect(page.getByText("Numbering Test Client").first()).toBeVisible();
    await expect(page.locator("text=/ACME-\\d+/").first()).toBeVisible({
      timeout: 10000,
    });
  });
});
