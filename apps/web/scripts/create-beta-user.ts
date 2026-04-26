/**
 * Manually provision a closed-beta user.
 *
 * Usage (from a container with DATABASE_URL set, via Coolify Terminal):
 *   pnpm tsx apps/web/scripts/create-beta-user.ts <email> "<full name>" "<org name>"
 *
 * Behavior:
 *   1. Calls better-auth signUpEmail with a long random temp password (user can never log in with it)
 *   2. Auth-server's databaseHooks creates the org automatically
 *   3. Calls auth.api.requestPasswordReset which fires the configured
 *      sendResetPassword hook (SMTP). The reset URL/token is NOT returned by
 *      the API — it is delivered via the configured email transport. If SMTP
 *      is not yet wired, check the worker logs for the rendered URL.
 */
import { config } from "dotenv";
config({ path: ".env.local" });
config(); // .env

import { auth } from "../lib/auth-server";
import { randomBytes } from "node:crypto";

async function main() {
  const [, , email, name, orgNameArg] = process.argv;
  if (!email || !name) {
    console.error(
      "Usage: pnpm tsx apps/web/scripts/create-beta-user.ts <email> '<name>' [orgName]",
    );
    process.exit(1);
  }

  const tempPassword = randomBytes(32).toString("base64url");

  console.log(`→ Creating user: ${email}`);
  await auth.api.signUpEmail({
    body: {
      email,
      name,
      password: tempPassword,
    },
  });
  console.log(`✅ User created`);

  // The auth.databaseHooks.user.create.after will have created an org
  // named "<name>'s Company" automatically. If a custom orgName was passed,
  // log that the user can rename the org from Settings.
  if (orgNameArg) {
    console.log(
      `   Note: org was auto-created from name. Rename to "${orgNameArg}" from Settings → Organisation after first login.`,
    );
  }

  console.log(`→ Triggering password reset email...`);
  // Direct in-process call — no LB round-trip, no fetch failure modes.
  // better-auth fires the configured sendResetPassword hook (SMTP).
  await auth.api.requestPasswordReset({
    body: { email, redirectTo: "/reset-password" },
  });

  console.log(
    `✅ Password-reset email sent to ${email} (assuming SMTP is configured).`,
  );
  console.log(
    `   If SMTP is not yet configured, check the worker logs for the reset URL.`,
  );

  console.log(
    `\n🎉 Done. Tell ${name} to check their inbox or visit /forgot-password.`,
  );
}

main().catch((err) => {
  console.error("Failed:", err);
  process.exit(1);
});
