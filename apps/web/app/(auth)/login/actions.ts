"use server";

import { ensureDemoAccount, isDemoModeEnabled } from "@/lib/demo/ensure";
import { DEMO_USER } from "@/lib/demo/data-pool";

// Returns the demo sign-in credentials the client should prefill and
// submit. Idempotently provisions the demo user + org + populated
// dataset if this is the first call on this deployment. Short-circuits
// when the feature flag is off so it can never leak creds in prod.
export async function getDemoCredentialsAction(): Promise<
  { email: string; password: string } | { error: string }
> {
  if (!isDemoModeEnabled()) {
    return { error: "Demo mode is not enabled on this deployment." };
  }
  await ensureDemoAccount();
  return { email: DEMO_USER.email, password: DEMO_USER.password };
}
