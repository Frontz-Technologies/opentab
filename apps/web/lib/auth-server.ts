import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import * as schema from "@opentab/db/schema";
import { generateUniqueSlug } from "./utils";
import { db } from "./db";

export const auth = betterAuth({
  baseURL: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
  trustedOrigins: [process.env.NEXT_PUBLIC_APP_URL].filter(Boolean) as string[],
  database: drizzleAdapter(db, {
    provider: "pg",
    schema,
  }),
  emailAndPassword: {
    enabled: true,
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
