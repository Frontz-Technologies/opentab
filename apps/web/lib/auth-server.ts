import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import * as schema from "@opentab/db/schema";
import { generateUniqueSlug } from "./utils";
import { db } from "./db";
import { deriveTrustedOrigins } from "./auth-trusted-origins";
import { createLogger } from "./logging/logger";

const log = createLogger("auth");

export const auth = betterAuth({
  // When unset, Better Auth derives the base URL from the incoming request
  // (apps/.../utils/url.mjs:getBaseURL → request origin). That is what we
  // want in production where the env may not propagate from Coolify into
  // the container — falling back to localhost would silently bake the
  // wrong origin into password-reset email links. Keeping `undefined`
  // here means a misconfigured env still produces correct, request-based
  // URLs.
  baseURL: process.env.NEXT_PUBLIC_APP_URL || undefined,
  trustedOrigins: deriveTrustedOrigins,
  database: drizzleAdapter(db, {
    provider: "pg",
    schema,
  }),
  emailAndPassword: {
    enabled: true,
    sendResetPassword: async ({ user, url }) => {
      // Self-hosters without SMTP configured: log the reset URL so they
      // can copy it into the user's chat. Never block the reset flow.
      if (!process.env.EMAIL_SMTP_HOST) {
        log.warn(
          "EMAIL_SMTP_HOST unset — emitting password-reset URL to logs",
          {
            userEmail: user.email,
            url,
          },
        );
        return;
      }
      const { sendEmail } = await import("./email/transport");
      await sendEmail({
        to: user.email,
        subject: "Reset your password",
        text: `Hello ${user.name ?? ""},

You requested a password reset for your account.

Click the link below to set a new password (valid for 1 hour):

${url}

If you didn't request this, you can safely ignore this email.`,
      });
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 30,
    cookieCache: {
      enabled: true,
      maxAge: 60 * 5,
    },
  },
  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          const orgName = `${user.name}'s Company`;
          const slug = generateUniqueSlug(orgName);

          const [org] = await db
            .insert(schema.organisations)
            .values({ name: orgName, slug })
            .returning();

          await db.insert(schema.orgMemberships).values({
            userId: user.id,
            orgId: org.id,
            role: "owner",
            acceptedAt: new Date(),
          });
        },
      },
    },
  },
});
