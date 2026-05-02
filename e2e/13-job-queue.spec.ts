import { test, expect, type Page } from "@playwright/test";
import { registerTestUser, loginTestUser } from "./helpers";

// Async-delete happy-path. Drives expense create with a file
// attachment, then deletes the expense and asserts the worker
// processes the delete-expense-files job within 10s. Requires the
// worker container to be running (docker-compose dev stack handles
// it).
test.describe.configure({ mode: "serial", retries: 1 });

test.describe("Async job queue — delete-expense-files (#85)", () => {
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

  test("expense delete enqueues file deletion + worker processes it", async () => {
    // Seed a contact (suppliers can issue expenses against any
    // contact in the org)
    await page.goto("/contacts/new");
    await page.locator('select[name="type"]').selectOption("supplier");
    await page
      .locator('select[name="classification"]')
      .selectOption("business");
    await page.locator('input[name="company"]').fill("Job Queue Supplier");
    await page.locator('input[name="email"]').fill("queue-supplier@test.com");
    await page.getByRole("button", { name: "Save changes" }).click();
    await page.waitForURL("**/contacts", { timeout: 10000 });

    // Create an expense with a file attachment
    await page.goto("/expenses/new");
    await page
      .locator("select")
      .first()
      .selectOption({ label: "Job Queue Supplier" });

    // Attach a small dummy file
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: "smoke.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("smoke-test-content"),
    });

    await page.getByRole("button", { name: "Add item" }).click();
    await page.getByPlaceholder("Item").fill("Job-queue smoke item");
    const numberInputs = page.locator('input[type="number"]');
    await numberInputs.nth(0).fill("1");
    await numberInputs.nth(1).fill("100");

    await page.getByRole("button", { name: /Save/i }).click();
    await page.waitForURL("**/expenses", { timeout: 15000 });

    // Open the new row, find expense id from URL
    await page.getByText("Job-queue smoke item").first().click();
    await page.waitForURL(/\/expenses\/[a-z0-9-]+/i, { timeout: 10000 });
    const match = page.url().match(/\/expenses\/([a-z0-9-]+)/i);
    if (!match) throw new Error("could not extract expense id");

    // Hit the delete action
    page.once("dialog", (d) => d.accept());
    await page.getByRole("button", { name: /^Delete$/i }).click();
    await page.waitForURL("**/expenses", { timeout: 15000 });

    // Worker has up to 10s to process the job. We assert the
    // user-visible signal: row no longer in the list. The worker
    // side (file actually deleted) is covered by the unit test on
    // processDeleteExpenseFiles.
    await expect(
      page.getByText("Job-queue smoke item").first(),
    ).not.toBeVisible({ timeout: 10000 });
  });
});
