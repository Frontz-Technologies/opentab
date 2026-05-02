import { test, expect, type Page } from "@playwright/test";
import { registerTestUser, loginTestUser } from "./helpers";

// Happy-path coverage for credit notes.
//
// Flow:
//   1. Seed a client + an invoice that the credit note will reference.
//   2. From the invoice detail page, click "Issue Credit Note" — this
//      navigates to /credit-notes/new pre-filled with invoiceId.
//   3. Add a line, save → credit note appears in the list as DRAFT.
//   4. Open detail, Publish → status flips, number is assigned.
//   5. Send → status flips again.
//   6. Hit the activity CSV endpoint and confirm the lifecycle rows
//      were written.
test.describe.configure({ mode: "serial", retries: 1 });

test.describe("Credit notes happy path", () => {
  let page: Page;
  let invoiceId: string;
  let creditNoteId: string;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    try {
      await registerTestUser(page);
    } catch {
      await loginTestUser(page);
    }

    await page.goto("/contacts/new");
    await page.locator('select[name="type"]').selectOption("client");
    await page
      .locator('select[name="classification"]')
      .selectOption("business");
    await page.locator('input[name="company"]').fill("Credit Note Client");
    await page.locator('input[name="email"]').fill("cn-client@test.com");
    await page.getByRole("button", { name: "Save changes" }).click();
    await page.waitForURL("**/contacts", { timeout: 10000 });

    await page.goto("/invoices/new");
    await page
      .locator("select")
      .first()
      .selectOption({ label: "Credit Note Client" });
    await page.getByRole("button", { name: "Add item" }).click();
    await page.getByPlaceholder("Item").fill("Original line item");
    const numberInputs = page.locator('input[type="number"]');
    await numberInputs.nth(0).fill("1");
    await numberInputs.nth(1).fill("500");
    await page.getByRole("button", { name: /Save|Draft/i }).click();
    await page.waitForURL("**/invoices", { timeout: 15000 });

    await page.getByText("Credit Note Client").first().click();
    await page.waitForURL(/\/invoices\/[a-z0-9-]+/i, { timeout: 10000 });
    const match = page.url().match(/\/invoices\/([a-z0-9-]+)/i);
    if (!match)
      throw new Error(`could not extract invoice id from ${page.url()}`);
    invoiceId = match[1];

    // Move the invoice to SENT so the "Issue Credit Note" button shows.
    page.once("dialog", (d) => d.accept());
    await page.getByRole("button", { name: /^Publish$/i }).click();
    await page.waitForLoadState("networkidle");
    page.once("dialog", (d) => d.accept());
    await page.getByRole("button", { name: /^Send$/i }).click();
    await page.waitForLoadState("networkidle");
  });

  test.afterAll(async () => {
    if (page) await page.close();
  });

  test("Issue Credit Note button navigates to /credit-notes/new with invoiceId pre-filled", async () => {
    await page.goto(`/invoices/${invoiceId}`);
    await page.getByRole("button", { name: /Issue Credit Note/i }).click();
    await page.waitForURL(
      new RegExp(`/credit-notes/new\\?invoiceId=${invoiceId}`),
      { timeout: 10000 },
    );
    expect(page.url()).toContain(`invoiceId=${invoiceId}`);
  });

  test("creates a draft credit note with a single line", async () => {
    await page.goto(`/credit-notes/new?invoiceId=${invoiceId}`);
    await page.getByRole("button", { name: /Add item/i }).click();
    await page.getByPlaceholder("Item").fill("Refunded line");
    const numberInputs = page.locator('input[type="number"]');
    await numberInputs.nth(0).fill("1");
    await numberInputs.nth(1).fill("100");
    await page.getByRole("button", { name: /Save|Draft/i }).click();
    await page.waitForURL("**/credit-notes", { timeout: 15000 });

    await page.getByText("Credit Note Client").first().click();
    await page.waitForURL(/\/credit-notes\/[a-z0-9-]+/i, { timeout: 10000 });
    const match = page.url().match(/\/credit-notes\/([a-z0-9-]+)/i);
    if (!match)
      throw new Error(`could not extract credit-note id from ${page.url()}`);
    creditNoteId = match[1];

    await expect(page.getByText(/Draft/i)).toBeVisible();
  });

  test("publish flips status and assigns CN-NNNN number", async () => {
    await page.goto(`/credit-notes/${creditNoteId}`);
    page.once("dialog", (d) => d.accept());
    await page.getByRole("button", { name: /^Publish$/i }).click();
    await page.waitForLoadState("networkidle");
    await expect(page.locator("h1")).toContainText(/CN-\d{4}/);
  });

  test("send flips status to SENT", async () => {
    await page.goto(`/credit-notes/${creditNoteId}`);
    page.once("dialog", (d) => d.accept());
    await page.getByRole("button", { name: /^Send$/i }).click();
    await page.waitForLoadState("networkidle");
    await expect(page.getByText(/Sent/i).first()).toBeVisible();
  });

  test("activity CSV endpoint returns the lifecycle rows", async () => {
    const response = await page.request.get(
      `/api/credit-notes/${creditNoteId}/activity.csv`,
    );
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain("text/csv");
    const body = await response.text();
    const lines = body.split("\r\n").filter((l) => l.length > 0);
    expect(lines[0]).toBe(
      "timestamp_iso,actor_email,actor_kind,type,payload_json",
    );
    const dataLines = lines.slice(1);
    expect(dataLines.some((l) => l.includes("credit_note.created"))).toBe(true);
    expect(dataLines.some((l) => l.includes("credit_note.published"))).toBe(
      true,
    );
    expect(dataLines.some((l) => l.includes("credit_note.sent"))).toBe(true);
  });

  test("PDF endpoint returns 200 application/pdf", async () => {
    const response = await page.request.get(
      `/api/credit-notes/${creditNoteId}/pdf`,
    );
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain("application/pdf");
  });
});
