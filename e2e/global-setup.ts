import { type FullConfig, request } from "@playwright/test";

/**
 * Warm Next.js dev-mode routes before any spec runs.
 *
 * `next dev` compiles each route on first hit; a cold `/login` or
 * `/api/auth/sign-in/email` compile commonly exceeds 45 s on the
 * Colima dev VM. Playwright has no awareness of compile state, so
 * `e2e/01-auth.spec.ts`'s first `page.goto("/login")` times out, and
 * every downstream spec's `beforeAll` cascades (`registerTestUser` /
 * `loginTestUser` hit cold auth endpoints and fail). See #176.
 *
 * This setup fires throwaway requests at each cold route so Next has
 * compiled them before any test runs. We do not care whether the
 * requests succeed — dummy POST payloads will fail auth validation
 * and that is fine; only the compile is needed.
 */
const WARMUP_ROUTES: Array<{
  method: "GET" | "POST";
  path: string;
  data?: unknown;
}> = [
  { method: "GET", path: "/login" },
  { method: "GET", path: "/register" },
  { method: "GET", path: "/dashboard" },
  {
    method: "POST",
    path: "/api/auth/sign-up/email",
    data: { email: "warmup@invalid", password: "warmup-noop", name: "Warmup" },
  },
  {
    method: "POST",
    path: "/api/auth/sign-in/email",
    data: { email: "warmup@invalid", password: "warmup-noop" },
  },
];

export default async function globalSetup(config: FullConfig): Promise<void> {
  const baseURL = config.projects[0]?.use?.baseURL ?? "http://localhost:3000";
  const ctx = await request.newContext({ baseURL, timeout: 120_000 });

  for (const r of WARMUP_ROUTES) {
    try {
      if (r.method === "GET") {
        await ctx.get(r.path);
      } else {
        await ctx.post(r.path, { data: r.data });
      }
    } catch {
      // Compile-time errors and auth failures are fine — we only care
      // about forcing Next.js to compile the route. Tests will exercise
      // actual behaviour after this setup completes.
    }
  }

  await ctx.dispose();
}
