import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: process.env.CI ? "github" : "html",
  use: {
    baseURL: process.env.E2E_BASE_URL || "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], channel: "chrome", headless: true },
    },
  ],
  webServer: process.env.CI
    ? undefined
    : {
        command:
          'DATABASE_URL="postgresql://opentab:opentab_dev@localhost:5432/opentab_dev" BETTER_AUTH_SECRET="e2e-test-secret-at-least-32-chars!" NEXT_PUBLIC_APP_URL="http://localhost:3000" REDIS_URL="redis://localhost:6379" pnpm --filter @opentab/web dev',
        url: "http://localhost:3000",
        reuseExistingServer: !process.env.CI,
        timeout: 30000,
      },
});
