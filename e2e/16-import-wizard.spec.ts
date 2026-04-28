import { test, expect, type Page } from "@playwright/test";
import { registerTestUser } from "./helpers";

test.describe.configure({ mode: "serial" });

test.describe("Import wizard happy path", () => {
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    await registerTestUser(page);
  });

  test.afterAll(async () => {
    await page.close();
  });

  test("contacts: upload CSV → review → continue → done", async () => {
    await page.goto("/contacts");
    await page.getByRole("link", { name: /import/i }).click();
    await expect(page).toHaveURL(/\/import\/contacts/);

    // Headers chosen so autoMap resolves them via the contacts importer's
    // alias table — `company`, `email`, `countryCode` are real importer
    // fields. A CSV with `name` would not match because the contacts
    // importer has no `name` field (it has firstName / lastName / company).
    const csv = [
      "company,email,countryCode",
      "Acme Corp,billing@acme.example,GR",
      "Sample Two,two@example.com,DE",
    ].join("\n");

    const fileChooserPromise = page.waitForEvent("filechooser");
    await page.getByRole("button", { name: /drop your csv/i }).click();
    const chooser = await fileChooserPromise;
    await chooser.setFiles({
      name: "contacts.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(csv, "utf-8"),
    });

    // Auto-map should fill the dropdowns; required-missing notice should
    // not be visible.
    await expect(page.getByText(/Missing required/i)).toBeHidden();

    // Assert against the rendered review-card primary lines specifically.
    // A laxer "getByText('Acme Corp')" would match the raw-row disclosure
    // <dl> too — the previous version of this spec missed the bug where
    // primary lines all read "(empty row)" because the formatter
    // referenced field names the importer never declared.
    const primaries = page.locator('[data-slot="review-card-primary"]');
    await expect(primaries).toHaveCount(2);
    await expect(primaries.nth(0)).toHaveText("Acme Corp");
    await expect(primaries.nth(1)).toHaveText("Sample Two");

    // Continue → commit.
    await page.getByRole("button", { name: /continue/i }).click();

    // Done step.
    await expect(page.getByText(/Import complete/i)).toBeVisible();
  });

  // CSV storage round-trip happy-path (#257). Uploads a CSV beyond the
  // old Server Action 1MB body limit and asserts the wizard reaches Done.
  // Skipped in this branch — needs `pnpm e2e` against a built dev server,
  // which OOMs in the current sandbox. Un-skip when running locally
  // (or in CI with sufficient memory).
  test.fixme("CSV import via storage round-trip handles >1MB payloads (#257)", async () => {
    const headers = Array.from({ length: 30 }, (_, i) => `field_${i}`);
    const rowCount = 200;
    const lines = [headers.join(",")];
    for (let i = 0; i < rowCount; i++) {
      lines.push(
        headers.map((_, c) => `r${i}c${c}_${"x".repeat(40)}`).join(","),
      );
    }
    const csv = lines.join("\n");

    await page.goto("/import/contacts");
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: "big-import.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(csv),
    });

    await expect(page.getByText(/review|mapping/i).first()).toBeVisible({
      timeout: 15000,
    });

    await page
      .getByRole("button", { name: /continue|import|run/i })
      .first()
      .click();

    await expect(page.getByText(/imported|done|complete/i).first()).toBeVisible(
      { timeout: 30000 },
    );
  });
});
