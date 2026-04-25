import { test, expect, type Page } from "@playwright/test";
import { registerTestUser, loginTestUser } from "./helpers";

// #215 happy-path. Owner uploads a small contacts CSV, accepts the
// auto-mapped columns, previews 2 rows, commits, and asserts both
// rows land in the contacts list. Then re-importing the same CSV
// produces 0 new contacts (idempotency dedup).
test.describe.configure({ mode: "serial", retries: 1 });

test.describe("Contacts CSV import (#215)", () => {
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

  test("uploads a 2-row contacts CSV and lands both rows", async () => {
    await page.goto("/import/contacts");

    const csv =
      "company,email,vatNumber\nImportTestCo,import-test@example.com,EL000111\nImportSecondCo,import-second@example.com,\n";

    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: "contacts.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(csv),
    });

    await page.getByRole("button", { name: /Continue/i }).click();
    await page.getByRole("button", { name: /^Import$/i }).click();
    await expect(page.getByText(/Created/i)).toBeVisible({ timeout: 10000 });
    await page.getByRole("button", { name: /^Done$/i }).click();
    await page.waitForURL("**/contacts", { timeout: 10000 });

    await expect(page.getByText("ImportTestCo").first()).toBeVisible();
    await expect(page.getByText("ImportSecondCo").first()).toBeVisible();
  });

  test("re-importing the same CSV reports duplicates", async () => {
    await page.goto("/import/contacts");
    const csv =
      "company,email,vatNumber\nImportTestCo,import-test@example.com,EL000111\nImportSecondCo,import-second@example.com,\n";
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: "contacts.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(csv),
    });
    await page.getByRole("button", { name: /Continue/i }).click();
    await page.getByRole("button", { name: /^Import$/i }).click();
    await expect(page.getByText(/Skipped \(duplicate\)/i)).toBeVisible({
      timeout: 10000,
    });
  });
});
