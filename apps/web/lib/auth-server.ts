import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { createDb } from "@opentab/db";
import { organisations, orgMemberships } from "@opentab/db/schema";
import { generateUniqueSlug } from "./utils";

const db = createDb(process.env.DATABASE_URL!);

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
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
