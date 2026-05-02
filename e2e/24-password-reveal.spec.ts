import { test, expect, type Page } from "@playwright/test";

test.describe("Password reveal (#285)", () => {
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
  });

  test.afterAll(async () => {
    await page.close();
  });

  test("login page reveal toggle flips input type", async () => {
    await page.goto("/login");
    const pwInput = page.locator('input[name="password"]');
    await pwInput.fill("hunter2");
    await expect(pwInput).toHaveAttribute("type", "password");

    const reveal = page.getByRole("button", { name: /show password/i });
    await reveal.click();
    await expect(pwInput).toHaveAttribute("type", "text");

    const hide = page.getByRole("button", { name: /hide password/i });
    await hide.click();
    await expect(pwInput).toHaveAttribute("type", "password");
  });
});
