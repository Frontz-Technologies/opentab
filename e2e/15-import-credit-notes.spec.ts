import { test, expect, type Page } from "@playwright/test";
import { registerTestUser, loginTestUser } from "./helpers";

// Credit-note CSV import happy-path. Credit-note imports require a
// contact to already exist (matching invoice import behaviour).
// The flow:
//   1. Create the contact via the existing contacts UI
//   2. Upload a 1-row credit-note CSV
//   3. Assert the row lands on /credit-notes
//   4. Re-import — confirm idempotency dedup
test.describe.configure({ mode: "serial", retries: 1 });

test.describe("Credit notes CSV import", () => {
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

  test("import + re-import produces 1 created then 1 duplicate", async () => {
    // Seed a client first — credit-notes import requires the contact
    // to already exist (auto-create-missing-contact is v1.1).
    await page.goto("/contacts/new");
    await page.locator('select[name="type"]').selectOption("client");
    await page
      .locator('select[name="classification"]')
      .selectOption("business");
    await page.locator('input[name="company"]').fill("CN Import Co");
    await page.locator('input[name="email"]').fill("cn-import@test.com");
    await page.getByRole("button", { name: "Save changes" }).click();
    await page.waitForURL("**/contacts", { timeout: 10000 });

    await page.goto("/import/credit-notes");
    const csv =
      "creditNoteNumber,issueDate,contactName,total,reason,itemName,quantity,unitPrice,taxRate\n" +
      "CN-IMPORT-0001,2026-04-25,CN Import Co,50.00,return,Refund,1,50.00,24\n";

    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: "credit-notes.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(csv),
    });

    await page.getByRole("button", { name: /Continue/i }).click();
    await page.getByRole("button", { name: /^Import$/i }).click();
    await expect(page.getByText(/Created/i)).toBeVisible({ timeout: 10000 });
    await page.getByRole("button", { name: /^Done$/i }).click();
    await page.waitForURL("**/credit-notes", { timeout: 10000 });

    await expect(page.getByText("CN-IMPORT-0001").first()).toBeVisible();

    // Re-import — same idempotency key → 0 created + 1 skipped.
    await page.goto("/import/credit-notes");
    await page.locator('input[type="file"]').setInputFiles({
      name: "credit-notes.csv",
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
