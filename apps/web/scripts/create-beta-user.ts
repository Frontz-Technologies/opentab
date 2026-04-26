/**
 * Manually provision a closed-beta user.
 *
 * Usage (from a container with DATABASE_URL set, via Coolify Terminal):
 *   pnpm tsx apps/web/scripts/create-beta-user.ts <email> "<full name>" "<org name>"
 *
 * Behavior:
 *   1. Calls better-auth signUpEmail with a long random temp password (user can never log in with it)
 *   2. Auth-server's databaseHooks creates the org automatically
 *   3. Triggers a password-reset email so the user sets their real password
 *   4. Prints the magic-link URL to stdout (in case email transport is down)
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
  // better-auth sendResetPassword hook will email the user.
  // We invoke the resetPassword endpoint directly so the user receives the link.
  // Using the public sign-in flow from a Node script is awkward;
  // instead we use better-auth's request-reset endpoint by calling the API.
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const res = await fetch(`${baseUrl}/api/auth/forget-password`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, redirectTo: "/reset-password" }),
  });
  if (!res.ok) {
    console.warn(
      `⚠️  Password-reset request returned ${res.status}. The user can use /forgot-password manually.`,
    );
  } else {
    console.log(`✅ Password-reset email sent to ${email}`);
  }

  console.log(`\n🎉 Done. Tell ${name} to check their inbox or visit /forgot-password.`);
}

main().catch((err) => {
  console.error("Failed:", err);
  process.exit(1);
});
