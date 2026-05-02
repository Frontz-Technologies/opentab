import { test, expect, type Page } from "@playwright/test";
import { registerTestUser, loginTestUser } from "./helpers";

test.describe.configure({ mode: "serial" });

const SEED_NAME = "Combobox Seed Supplier";
const SEED_VAT = "EL999111222";

test.describe("Supplier combobox", () => {
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    try {
      await registerTestUser(page);
    } catch {
      await loginTestUser(page);
    }

    await page.goto("/contacts/new");
    await page.locator('select[name="type"]').selectOption("supplier");
    await page
      .locator('select[name="classification"]')
      .selectOption("business");
    await page.locator('input[name="company"]').fill(SEED_NAME);
    await page.locator('input[name="vatNumber"]').fill(SEED_VAT);
    await page.getByRole("button", { name: "Save changes" }).click();
    await page.waitForURL("**/contacts", { timeout: 10000 });
  });

  test.afterAll(async () => {
    await page.close();
  });

  test("typeahead filters and picks an existing supplier", async () => {
    await page.goto("/expenses/new");

    const supplierInput = page.getByPlaceholder("Select or type a supplier");
    await supplierInput.fill("Combobox");

    const option = page.getByRole("option").filter({ hasText: SEED_NAME });
    await expect(option).toBeVisible();
    await option.click();

    await expect(page.getByText(SEED_NAME)).toBeVisible();
    await expect(page.getByText(SEED_VAT)).toBeVisible();
    await expect(page.getByRole("button", { name: "Clear" })).toBeVisible();
  });

  test("free-text + new VAT shows Add-as-contact prompt", async () => {
    await page.goto("/expenses/new");

    const supplierInput = page.getByPlaceholder("Select or type a supplier");
    await supplierInput.fill("BrandNew Vendor LLC");
    // Press Escape to close the popover (no match for this name)
    await supplierInput.press("Escape");

    const vatInput = page.getByPlaceholder("VAT / Tax ID");
    await vatInput.fill("EL777888999");

    // Wait for the debounced VAT-match check to settle (300ms + buffer).
    await page.waitForTimeout(800);

    await expect(
      page.getByRole("button", {
        name: /Add BrandNew Vendor LLC to your contacts/i,
      }),
    ).toBeVisible();
  });

  test("VAT matching an existing contact auto-promotes to contact-mode", async () => {
    await page.goto("/expenses/new");

    const supplierInput = page.getByPlaceholder("Select or type a supplier");
    await supplierInput.fill("Unrelated Free Text");
    await supplierInput.press("Escape");

    const vatInput = page.getByPlaceholder("VAT / Tax ID");
    await vatInput.fill(SEED_VAT);

    // Wait for the debounced VAT-match check + state transition.
    await expect(
      page.getByText(/VAT matches existing contact, switching to/i),
    ).toBeVisible({ timeout: 4000 });
    await expect(page.getByText(SEED_NAME)).toBeVisible();
    await expect(page.getByRole("button", { name: "Clear" })).toBeVisible();
  });
});
