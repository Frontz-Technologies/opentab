import { test, expect, type Page } from "@playwright/test";
import { registerTestUser, loginTestUser } from "./helpers";

test.describe.configure({ mode: "serial" });

test.describe("Business Lookup (#280 + #287)", () => {
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

  test("contacts/new — VIES button autofills company name", async () => {
    await page.route(
      "**/taxation_customs/vies/rest-api/check-vat-number",
      async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            valid: true,
            name: "ACME EUROPE LTD",
            address: "MAIN STREET 1\n12345 BRUSSELS",
          }),
        });
      },
    );

    await page.goto("/contacts/new");

    const vatInput = page.locator('input[name="vatNumber"]');
    await vatInput.fill("BE0123456789");

    const lookupButton = page.getByRole("button", { name: "Lookup" });
    await expect(lookupButton).toBeVisible();
    await lookupButton.click();

    await expect(page.locator('input[name="company"]')).toHaveValue(
      "ACME EUROPE LTD",
    );
  });

  test("contacts/new — button hidden for unrecognized format", async () => {
    await page.goto("/contacts/new");

    await page.locator('input[name="vatNumber"]').fill("US12-3456789");
    await expect(page.getByRole("button", { name: "Lookup" })).toHaveCount(0);
  });

  test("expenses/new — button shown only with EU VAT in free-text mode", async () => {
    await page.goto("/expenses/new");

    await expect(page.getByRole("button", { name: "Lookup" })).toHaveCount(0);

    const vatInput = page.getByPlaceholder("VAT / Tax ID");
    await vatInput.fill("BE0123456789");
    await expect(page.getByRole("button", { name: "Lookup" })).toBeVisible();

    await vatInput.fill("US12-3456789");
    await expect(page.getByRole("button", { name: "Lookup" })).toHaveCount(0);
  });

  test("contacts/new — Greek AFM via GEMI public lookup autofills name", async () => {
    await page.route(
      "https://publicity.businessportal.gr/api/autocomplete/802315517",
      async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            payload: {
              autocomplete: [
                {
                  id: 0,
                  arGemi: 174184603000,
                  title: "FRONTZ TECHNOLOGIES",
                  co_name: "ΦΡΟΝΤΖΟΣ ΙΩΑΝΝΗΣ ΚΑΙ ΣΙΑ Ε.Ε.",
                  afm: "802315517",
                  companyStatus: "Ενεργή",
                  companyStatusId: 3,
                  type: "Επιχείρηση",
                },
              ],
            },
          }),
        });
      },
    );

    await page.goto("/contacts/new");
    await page.locator('input[name="vatNumber"]').fill("802315517");
    await page.getByRole("button", { name: "Lookup" }).click();

    await expect(page.locator('input[name="company"]')).toHaveValue(
      "ΦΡΟΝΤΖΟΣ ΙΩΑΝΝΗΣ ΚΑΙ ΣΙΑ Ε.Ε.",
    );
  });

  test("integrations page shows Business Lookup card", async () => {
    await page.goto("/settings/integrations");

    await expect(page.getByText("Business Lookup")).toBeVisible();

    await page.getByText("Business Lookup").first().click();
    await page.waitForURL("**/settings/integrations/business-lookup");

    await expect(page.getByText("Active sources")).toBeVisible();
    await expect(page.getByText("GEMI (public lookup)")).toBeVisible();
    await expect(page.getByText("VIES (EU VAT")).toBeVisible();
    // Status badge
    await expect(page.getByText(/^Enabled$/i).first()).toBeVisible();
  });
});
