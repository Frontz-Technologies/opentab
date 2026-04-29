import { test, expect, type Page } from "@playwright/test";
import { registerTestUser, loginTestUser } from "./helpers";

// Regression guard for #271. The icon-system migration changed
// InsightCard.icon from `string` to `LucideIcon` (a function reference);
// the dashboard insights pipeline runs in a Server Component and ships
// its output to <DashboardClient> ("use client"), so the React Server
// Components serializer rejected the function references with
//   "Only plain objects can be passed to Client Components from Server
//    Components."
// CI's Lint, Test & Build job missed it because the failure only fires
// at request time. This spec navigates to /dashboard, asserts no RSC
// serialization errors land in the console, and confirms each insight
// card produced by the server renders with a non-empty <svg> child.
test.describe.configure({ mode: "serial", retries: 1 });

test.describe("Dashboard insights — RSC regression guard (#271)", () => {
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

  test("dashboard renders without RSC serialization errors", async () => {
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");
    // The Next.js error boundary fallback would render an "Application
    // error" surface if the RSC payload deserialization failed.
    await expect(page.locator("body")).not.toContainText(
      /Application error|Only plain objects can be passed/i,
    );
  });

  test("insight cards render with valid lucide icons", async () => {
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");

    const cards = page.locator("[data-testid='insight-card']");
    const count = await cards.count();
    if (count === 0) {
      // A fresh demo org with no transactions yet may produce zero
      // insights — that's an acceptable empty-state, not a regression.
      // Confirm the dashboard heading rendered to prove the page loaded
      // through the RSC pipeline successfully.
      await expect(
        page.getByRole("heading", { level: 1 }).first(),
      ).toBeVisible();
      return;
    }
    for (let i = 0; i < count; i++) {
      const card = cards.nth(i);
      await expect(card.locator("svg").first()).toBeVisible();
    }
  });

  test("no console errors mention RSC serialization", async () => {
    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });
    await page.reload();
    await page.waitForLoadState("networkidle");

    const rscErrors = errors.filter((e) =>
      /Only plain objects|cannot be passed to Client Components|Functions cannot be passed/.test(
        e,
      ),
    );
    expect(rscErrors).toEqual([]);
  });
});
