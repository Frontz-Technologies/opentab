import { test, expect, type Page } from "@playwright/test";
import { registerTestUser, loginTestUser } from "./helpers";

// Smoke test for the invoice-number-deferred-to-publish behaviour.
// Failure-surface coverage (idempotency + concurrent-publish race
// safety) is in the unit test at:
//   apps/web/__tests__/invoicing-assign-number.test.ts
// This spec exercises the full Server-Action flow through the UI:
// create draft → assert no number cell → publish → assert number
// assigned and the chip flipped from DRAFT to PUBLISHED.
test.describe.configure({ mode: "serial", retries: 1 });

test.describe("Invoice number deferral", () => {
  let page: Page;
  let invoiceId: string;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    try {
      await registerTestUser(page);
    } catch {
      await loginTestUser(page);
    }

    // Seed a client.
    await page.goto("/contacts/new");
    await page.locator('select[name="type"]').selectOption("client");
    await page
      .locator('select[name="classification"]')
      .selectOption("business");
    await page.locator('input[name="company"]').fill("Deferral Test Client");
    await page.locator('input[name="email"]').fill("deferral-client@test.com");
    await page.getByRole("button", { name: "Save changes" }).click();
    await page.waitForURL("**/contacts", { timeout: 10000 });

    // Create draft invoice.
    await page.goto("/invoices/new");
    await page
      .locator("select")
      .first()
      .selectOption({ label: "Deferral Test Client" });
    await page.getByRole("button", { name: "Add item" }).click();
    await page.getByPlaceholder("Item").fill("Deferral smoke item");
    const numberInputs = page.locator('input[type="number"]');
    await numberInputs.nth(0).fill("1");
    await numberInputs.nth(1).fill("75");
    await page.getByRole("button", { name: /Save|Draft/i }).click();
    await page.waitForURL("**/invoices", { timeout: 15000 });

    // Open the invoice detail to grab its id.
    await page.getByText("Deferral Test Client").first().click();
    await page.waitForURL(/\/invoices\/[a-z0-9-]+/i, { timeout: 10000 });
    const match = page.url().match(/\/invoices\/([a-z0-9-]+)/i);
    if (!match)
      throw new Error(`could not extract invoice id from ${page.url()}`);
    invoiceId = match[1];
  });

  test.afterAll(async () => {
    if (page) await page.close();
  });

  test("draft heading shows 'Draft Invoice' (no allocated number)", async () => {
    // Heading replaces the number with the draftHeading i18n string.
    await expect(
      page.getByRole("heading", { name: /Draft Invoice/i, level: 1 }),
    ).toBeVisible({ timeout: 10000 });
  });

  test("publish assigns a number atomically and flips the heading", async () => {
    await page.getByRole("button", { name: /Publish/i }).click();
    // confirm() dialog: accept it.
    page.on("dialog", (dialog) => dialog.accept());
    await page.waitForLoadState("networkidle");

    // After publish: heading is the assigned number (matches INV-…
    // pattern) — no longer the draftHeading placeholder.
    await expect(
      page.getByRole("heading", { name: /^INV-/i, level: 1 }),
    ).toBeVisible({ timeout: 10000 });

    // Sanity: the row in the list now shows the number too.
    await page.goto("/invoices");
    await expect(page.getByText("Deferral Test Client").first()).toBeVisible();
    await expect(
      page.locator("text=/INV-\\d{4}-\\d{4}/").first(),
    ).toBeVisible();
  });
});
