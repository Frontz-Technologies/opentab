import { createAuthClient } from "better-auth/react";

// NEXT_PUBLIC_APP_URL is baked into the client bundle at `next build` time.
// If a deploy forgets to pass it, fall back to the current page origin in
// the browser instead of localhost:3000 — otherwise the bundle hard-codes
// localhost into auth fetches and they fail CORS from the deployed origin.
const baseURL =
  process.env.NEXT_PUBLIC_APP_URL ||
  (typeof window !== "undefined" ? window.location.origin : undefined);

export const authClient = createAuthClient({ baseURL });

export const { signIn, signUp, signOut, useSession } = authClient;
