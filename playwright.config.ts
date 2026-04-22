import { defineConfig, devices } from "@playwright/test";
import { randomUUID } from "node:crypto";

// Generate a single RUN_ID for the whole test invocation, set it as an
// env var, and let helpers.ts read it. Setting it here (at config
// module load) guarantees it exists before workers spawn and is
// inherited via `process.env`. Workers re-evaluate `helpers.ts` per
// spec file, so generating the ID inside helpers would produce a
// different value per spec and defeat the cross-spec user share.
// See #178 / PR #179 tester regression.
process.env.OPENTAB_E2E_RUN_ID ??= randomUUID().slice(0, 8);
console.log(`[playwright] run id = ${process.env.OPENTAB_E2E_RUN_ID}`);

export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  // Raise the default per-test/hook timeout from 30s. Specs 05–09
  // beforeAll hooks do a full sign-in redirect chain on first compile;
  // under Colima dev-VM latency this can exceed 30s and the fired
  // timeout tears down the context mid-POST, surfacing as
  // "apiRequestContext.post: Target page, context or browser has been
  // closed" on /api/auth/sign-in/email. See #179 tester follow-up.
  timeout: 60_000,
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
    {
      name: "mobile-chromium",
      use: { ...devices["Pixel 5"], channel: "chrome", headless: true },
    },
  ],
  webServer: process.env.CI
    ? undefined
    : {
        // Run tests against a built + `next start` app, NOT `next dev`.
        // Tester iteration at SHA 4985901 confirmed a 10× speedup on
        // list-page navigations (demo-mode spec 120 s timeout → 9.4 s
        // PASS) because `next start` serves pre-compiled routes instead
        // of paying 5–20 s per-route cold compile on first visit. Build
        // runs once (~1–2 min); subsequent test runs reuse the server
        // via `reuseExistingServer`.
        //
        // NEXT_PUBLIC_* env vars are baked at build time, so they must
        // be set on the build command too (and repeated for start — node
        // env isn't shared across the `&&` boundary in POSIX sh).
        command:
          'DATABASE_URL="postgresql://opentab:opentab_dev@localhost:5432/opentab_dev" BETTER_AUTH_SECRET="e2e-test-secret-at-least-32-chars!" NEXT_PUBLIC_APP_URL="http://localhost:3000" REDIS_URL="redis://localhost:6379" DEMO_SAMPLE_DATA_ENABLED=true NEXT_PUBLIC_DEMO_SAMPLE_DATA_ENABLED=true pnpm --filter @opentab/web build && DATABASE_URL="postgresql://opentab:opentab_dev@localhost:5432/opentab_dev" BETTER_AUTH_SECRET="e2e-test-secret-at-least-32-chars!" NEXT_PUBLIC_APP_URL="http://localhost:3000" REDIS_URL="redis://localhost:6379" DEMO_SAMPLE_DATA_ENABLED=true NEXT_PUBLIC_DEMO_SAMPLE_DATA_ENABLED=true pnpm --filter @opentab/web start',
        url: "http://localhost:3000",
        reuseExistingServer: !process.env.CI,
        // Accommodate first-time build: pnpm build + .next compile ≈ 1–2 min.
        timeout: 300_000,
      },
});
