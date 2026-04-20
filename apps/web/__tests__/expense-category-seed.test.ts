import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { eq } from "drizzle-orm";
import { createTestDb } from "@opentab/db/test-utils";
import {
  organisations,
  expenseGroups,
  expenseCategories,
} from "@opentab/db/schema";
import { seedExpenseCategories } from "../lib/expenses/category-seed";

describe("seedExpenseCategories race safety (#170)", () => {
  let db: Awaited<ReturnType<typeof createTestDb>>["db"];
  let teardown: () => Promise<void>;

  beforeAll(async () => {
    const ctx = await createTestDb();
    db = ctx.db;
    teardown = ctx.teardown;
  });

  afterAll(async () => {
    await teardown();
  });

  it("two concurrent calls for the same org do not throw and leave 16 categories", async () => {
    const [org] = await db
      .insert(organisations)
      .values({ name: "Race A", slug: "race-a", countryCode: "GR" })
      .returning();

    await expect(
      Promise.all([
        seedExpenseCategories(org.id, "GR", db),
        seedExpenseCategories(org.id, "GR", db),
      ]),
    ).resolves.not.toThrow();

    const cats = await db
      .select()
      .from(expenseCategories)
      .where(eq(expenseCategories.orgId, org.id));
    expect(cats.length).toBe(16);

    const groups = await db.select().from(expenseGroups);
    expect(groups.length).toBe(16);
  });

  it("two concurrent calls for different orgs do not collide on the global expense_group seed", async () => {
    const [orgB] = await db
      .insert(organisations)
      .values({ name: "Race B", slug: "race-b", countryCode: "GR" })
      .returning();
    const [orgC] = await db
      .insert(organisations)
      .values({ name: "Race C", slug: "race-c", countryCode: null })
      .returning();

    await expect(
      Promise.all([
        seedExpenseCategories(orgB.id, "GR", db),
        seedExpenseCategories(orgC.id, null, db),
      ]),
    ).resolves.not.toThrow();

    const groups = await db.select().from(expenseGroups);
    expect(groups.length).toBe(16);
  });

  it("subsequent calls for the same org are idempotent (early-return)", async () => {
    const [org] = await db
      .insert(organisations)
      .values({ name: "Idem", slug: "idem", countryCode: "GR" })
      .returning();

    await seedExpenseCategories(org.id, "GR", db);
    await seedExpenseCategories(org.id, "GR", db);
    await seedExpenseCategories(org.id, "GR", db);

    const cats = await db
      .select()
      .from(expenseCategories)
      .where(eq(expenseCategories.orgId, org.id));
    expect(cats.length).toBe(16);
  });
});
