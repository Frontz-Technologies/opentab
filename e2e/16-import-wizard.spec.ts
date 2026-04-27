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

    const csv = [
      "name,email,countryCode",
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

    // Review list should render the two row primaries.
    await expect(page.getByText("Acme Corp")).toBeVisible();
    await expect(page.getByText("Sample Two")).toBeVisible();

    // Continue → commit.
    await page.getByRole("button", { name: /continue/i }).click();

    // Done step.
    await expect(page.getByText(/Import complete/i)).toBeVisible();
  });
});
