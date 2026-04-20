import { test, expect, type Page } from "@playwright/test";
import { registerTestUser, loginTestUser, TEST_USER } from "./helpers";

test.describe.configure({ mode: "serial" });

test.describe("Contacts", () => {
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
    await page.close();
  });

  test("contacts list page shows empty state", async () => {
    await page.goto("/contacts");
    // `{ exact: true }` prevents the matcher from also picking up the
    // empty-state "No contacts yet" h3 (substring match includes the
    // word "Contacts"). See #179 tester follow-up.
    await expect(
      page.getByRole("heading", { name: "Contacts", exact: true }),
    ).toBeVisible();
    await expect(page.getByText("No contacts yet")).toBeVisible();
    // Two "Add Contact" links render on the empty-state page: the
    // header CTA and the empty-state body CTA. Assert that at least
    // one is visible rather than triggering strict-mode on the pair.
    await expect(
      page.getByRole("link", { name: "Add Contact" }).first(),
    ).toBeVisible();
  });

  test("contacts list has search and type filters", async () => {
    await expect(page.getByPlaceholder("Search contacts...")).toBeVisible();
    await expect(page.getByRole("button", { name: "All" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Clients" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Suppliers" })).toBeVisible();
  });

  test("navigate to create contact page", async () => {
    await page.getByRole("link", { name: "Add Contact" }).click();
    await page.waitForURL("**/contacts/new");
    await expect(
      page.getByRole("heading", { name: "Add Contact" }),
    ).toBeVisible();
  });

  test("contact form has all required sections", async () => {
    await expect(page.getByRole("heading", { name: "Type" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Company" })).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "VAT / Tax ID" }),
    ).toBeVisible();
    await expect(page.getByRole("heading", { name: "Address" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Defaults" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Notes" })).toBeVisible();
  });

  test("contact form has type and classification dropdowns", async () => {
    const typeSelect = page.locator('select[name="type"]');
    await expect(typeSelect).toBeVisible();
    await expect(typeSelect.locator("option")).toHaveCount(3); // client, supplier, both

    const classSelect = page.locator('select[name="classification"]');
    await expect(classSelect).toBeVisible();
    await expect(classSelect.locator("option")).toHaveCount(3); // individual, business, government
  });

  test("create a client contact", async () => {
    await page.locator('select[name="type"]').selectOption("client");
    await page
      .locator('select[name="classification"]')
      .selectOption("business");
    await page.locator('input[name="company"]').fill("Acme Corp");
    await page.locator('input[name="firstName"]').fill("John");
    await page.locator('input[name="lastName"]').fill("Doe");
    await page.locator('input[name="email"]').fill("john@acme.com");
    await page.locator('input[name="phone"]').fill("+30 210 1234567");
    await page.locator('input[name="addressLine1"]').fill("Ermou 25");
    await page.locator('input[name="city"]').fill("Athens");
    await page.locator('input[name="postalCode"]').fill("10563");
    await page.locator('select[name="defaultCurrency"]').selectOption("EUR");
    await page.locator('select[name="defaultLanguage"]').selectOption("en");
    await page.locator('input[name="defaultPaymentTerms"]').fill("30");

    await page.getByRole("button", { name: "Save changes" }).click();
    await page.waitForURL("**/contacts", { timeout: 10000 });
  });

  test("created contact appears in list", async () => {
    // Wait for redirect after save — may need explicit navigation
    if (!page.url().endsWith("/contacts")) {
      await page.goto("/contacts");
    }
    await expect(page.getByRole("link", { name: "Acme Corp" })).toBeVisible({
      timeout: 10000,
    });
    await expect(page.getByText("john@acme.com")).toBeVisible();
  });

  test("create a supplier contact", async () => {
    await page.getByRole("link", { name: "Add Contact" }).click();
    await page.waitForURL("**/contacts/new");

    await page.locator('select[name="type"]').selectOption("supplier");
    await page.locator('input[name="company"]').fill("Office Supplies Ltd");
    await page.locator('input[name="email"]').fill("orders@officesupplies.com");

    await page.getByRole("button", { name: "Save changes" }).click();
    await page.waitForURL("**/contacts", { timeout: 10000 });
  });

  test("both contacts appear in list", async () => {
    await expect(page.getByRole("link", { name: "Acme Corp" })).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Office Supplies Ltd" }),
    ).toBeVisible();
  });

  test("filter contacts by type - clients only", async () => {
    await page.getByRole("button", { name: "Clients" }).click();
    await expect(page.getByRole("link", { name: "Acme Corp" })).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Office Supplies Ltd" }),
    ).not.toBeVisible();
  });

  test("filter contacts by type - suppliers only", async () => {
    await page.getByRole("button", { name: "Suppliers" }).click();
    await expect(
      page.getByRole("link", { name: "Office Supplies Ltd" }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Acme Corp" }),
    ).not.toBeVisible();
  });

  test("filter contacts - show all again", async () => {
    await page.getByRole("button", { name: "All" }).click();
    await expect(page.getByRole("link", { name: "Acme Corp" })).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Office Supplies Ltd" }),
    ).toBeVisible();
  });

  test("search contacts by name", async () => {
    await page.getByPlaceholder("Search contacts...").fill("Acme");
    await expect(page.getByRole("link", { name: "Acme Corp" })).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Office Supplies Ltd" }),
    ).not.toBeVisible();
    await page.getByPlaceholder("Search contacts...").clear();
  });

  test("edit contact - page loads with data", async () => {
    await page.getByRole("link", { name: "Acme Corp" }).click();
    await page.waitForURL("**/contacts/**");
    await expect(
      page.getByRole("heading", { name: "Edit Contact" }),
    ).toBeVisible();
    await expect(page.locator('input[name="company"]')).toHaveValue(
      "Acme Corp",
    );
    await expect(page.locator('input[name="firstName"]')).toHaveValue("John");
    await expect(page.locator('input[name="email"]')).toHaveValue(
      "john@acme.com",
    );
  });
});
