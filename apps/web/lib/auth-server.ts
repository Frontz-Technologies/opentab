import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { createDb } from "@opentab/db";
import * as schema from "@opentab/db/schema";
import { generateUniqueSlug } from "./utils";

const db = createDb(process.env.DATABASE_URL!);

export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL || "http://localhost:3000",
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
            .insert(organisations)
            .values({ name: orgName, slug })
            .returning();

          await db.insert(orgMemberships).values({
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
