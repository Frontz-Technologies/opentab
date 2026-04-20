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
  // Auth-gated routes that specs navigate to after login. Cold-compile
  // on first visit otherwise lands inside a spec's test body and blows
  // the test timeout. Unauthenticated GETs get redirected to /login,
  // which is fine — middleware + the page component still compile. See
  // PR #179 tester report (spec 03 `/products` cold-compile stall).
  { method: "GET", path: "/products" },
  { method: "GET", path: "/contacts" },
  { method: "GET", path: "/invoices" },
  { method: "GET", path: "/expenses" },
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
  const startedAt = Date.now();

  for (const r of WARMUP_ROUTES) {
    try {
      if (r.method === "GET") {
        await ctx.get(r.path);
      } else {
        await ctx.post(r.path, { data: r.data });
      }
    } catch (err) {
      // Auth-validation failures on dummy payloads (400/422) are
      // expected and swallowed silently — the HTTP call already forced
      // Next.js to compile the route, which is all we need. Log
      // anything else (connection refused, DNS failure, timeout) so a
      // real misconfiguration doesn't fail quietly.
      const msg = err instanceof Error ? err.message : String(err);
      if (!/\b(40\d|41\d|42\d)\b/.test(msg)) {
        console.warn(
          `[e2e global-setup] ${r.method} ${r.path} warmup warning: ${msg}`,
        );
      }
    }
  }

  await ctx.dispose();
  const durationMs = Date.now() - startedAt;
  console.log(
    `[e2e global-setup] warmup complete in ${durationMs} ms ` +
      `(${WARMUP_ROUTES.length} routes)`,
  );
}
