import { createDb } from "./client.js";
import { users, organisations, orgMemberships } from "./schema/index.js";

const db = createDb(process.env.DATABASE_URL!);

async function seed() {
  console.log("Seeding database...");

  const [user] = await db
    .insert(users)
    .values({
      id: "demo-user-001",
      email: "demo@opentab.tech",
      name: "Demo User",
      emailVerified: true,
    })
    .returning();

  const [org] = await db
    .insert(organisations)
    .values({
      name: "Demo Company",
      slug: "demo-company",
      defaultCurrency: "EUR",
      taxId: "123456789",
      countryCode: "GR",
    })
    .returning();

  await db.insert(orgMemberships).values({
    userId: user.id,
    orgId: org.id,
    role: "owner",
    acceptedAt: new Date(),
  });

  console.log("Seed complete!");
  console.log(`  User: ${user.email} (id: ${user.id})`);
  console.log(`  Org: ${org.name} (slug: ${org.slug})`);

  process.exit(0);
}

seed().catch((e) => {
  console.error("Seed failed:", e);
  process.exit(1);
});
