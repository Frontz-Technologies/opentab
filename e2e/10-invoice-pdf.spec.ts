import { test, expect, type Page } from "@playwright/test";
import { registerTestUser, loginTestUser } from "./helpers";

// Smoke test for /api/invoices/[id]/pdf — golden path through the
// Gotenberg wrapper. Failure-surface coverage (timeout / retry /
// transient-vs-deterministic classification) is in the unit test at
// apps/web/__tests__/invoicing-pdf.test.ts (#155).
//
// This spec needs a reachable Gotenberg instance. The Playwright
// webServer config does not start one, so devs must either:
//   1. `docker compose -f docker/docker-compose.dev.yml up -d gotenberg`
//      and set GOTENBERG_URL=http://localhost:3100 before pnpm e2e, or
//   2. accept that this test self-skips when Gotenberg isn't reachable.
test.describe.configure({ mode: "serial", retries: 1 });

const GOTENBERG_PROBE_URL = (
  process.env.GOTENBERG_URL ?? "http://localhost:3100"
).replace(/\/$/, "");

async function gotenbergReachable(): Promise<boolean> {
  try {
    const res = await fetch(`${GOTENBERG_PROBE_URL}/health`, {
      signal: AbortSignal.timeout(2000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

test.describe("Invoice PDF route (#155)", () => {
  let page: Page;
  let invoiceId: string;
  let gotenbergUp = false;

  test.beforeAll(async ({ browser }) => {
    gotenbergUp = await gotenbergReachable();
    if (!gotenbergUp) {
      console.info(
        `[10-invoice-pdf] skipping — Gotenberg not reachable at ` +
          `${GOTENBERG_PROBE_URL}/health. Bring it up with ` +
          `\`docker compose -f docker/docker-compose.dev.yml up -d gotenberg\` ` +
          `and set GOTENBERG_URL=http://localhost:3100 to exercise this spec.`,
      );
      return;
    }

    page = await browser.newPage();
    try {
      await registerTestUser(page);
    } catch {
      await loginTestUser(page);
    }

    // Seed the minimum data needed to create an invoice.
    await page.goto("/contacts/new");
    await page.locator('select[name="type"]').selectOption("client");
    await page
      .locator('select[name="classification"]')
      .selectOption("business");
    await page.locator('input[name="company"]').fill("PDF Test Client");
    await page.locator('input[name="email"]').fill("pdf-client@test.com");
    await page.getByRole("button", { name: "Save changes" }).click();
    await page.waitForURL("**/contacts", { timeout: 10000 });

    await page.goto("/invoices/new");
    await page
      .locator("select")
      .first()
      .selectOption({ label: "PDF Test Client" });
    await page.getByRole("button", { name: "Add item" }).click();
    await page.getByPlaceholder("Item").fill("PDF smoke item");
    const numberInputs = page.locator('input[type="number"]');
    await numberInputs.nth(0).fill("1");
    await numberInputs.nth(1).fill("42");
    await page.getByRole("button", { name: /Save|Draft/i }).click();
    await page.waitForURL("**/invoices", { timeout: 15000 });

    await page.getByText("PDF Test Client").first().click();
    await page.waitForURL(/\/invoices\/[a-z0-9-]+/i, { timeout: 10000 });
    const match = page.url().match(/\/invoices\/([a-z0-9-]+)/i);
    if (!match)
      throw new Error(`could not extract invoice id from ${page.url()}`);
    invoiceId = match[1];
  });

  test.afterAll(async () => {
    if (page) await page.close();
  });

  test("GET /api/invoices/[id]/pdf returns a real PDF body", async () => {
    test.skip(!gotenbergUp, "Gotenberg not reachable");

    const response = await page.request.get(`/api/invoices/${invoiceId}/pdf`);

    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain("application/pdf");

    const body = await response.body();
    // Magic bytes for any PDF version: "%PDF-".
    expect(body.subarray(0, 5).toString("ascii")).toBe("%PDF-");
    // Sanity: a real Gotenberg-rendered single-line invoice is ≥ 1 KB.
    expect(body.length).toBeGreaterThan(1024);
  });
});
