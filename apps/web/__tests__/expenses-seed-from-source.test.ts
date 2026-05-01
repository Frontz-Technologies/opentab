import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createTestDb } from "@opentab/db/test-utils";
import { expenses, organisations } from "@opentab/db/schema";
import { loadSeedFromSource } from "../lib/expenses/seed-from-source";

describe("loadSeedFromSource", () => {
  let db: Awaited<ReturnType<typeof createTestDb>>["db"];
  let teardown: () => Promise<void>;
  let orgAId: string;
  let orgBId: string;

  beforeAll(async () => {
    const ctx = await createTestDb();
    db = ctx.db;
    teardown = ctx.teardown;
    const [orgA] = await db
      .insert(organisations)
      .values({ name: "OrgA", slug: "org-a", countryCode: "GR" })
      .returning();
    const [orgB] = await db
      .insert(organisations)
      .values({ name: "OrgB", slug: "org-b", countryCode: "GR" })
      .returning();
    orgAId = orgA.id;
    orgBId = orgB.id;
  });

  afterAll(async () => {
    await teardown();
  });

  it("returns null when source id is missing", async () => {
    const seed = await loadSeedFromSource(db, orgAId, null);
    expect(seed).toBeNull();
  });

  it("returns null when source belongs to a different org", async () => {
    const [src] = await db
      .insert(expenses)
      .values({
        orgId: orgAId,
        expenseNumber: "EXP-1",
        expenseDate: "2026-01-15",
        currencyCode: "EUR",
        exchangeRate: "1.000000",
      })
      .returning();
    // Probe from a different org
    const seed = await loadSeedFromSource(db, orgBId, src.id);
    expect(seed).toBeNull();
  });

  it("returns a seed payload (without expenseDate) when source is in same org", async () => {
    const [src] = await db
      .insert(expenses)
      .values({
        orgId: orgAId,
        expenseNumber: "EXP-2",
        expenseDate: "2026-01-15",
        currencyCode: "USD",
        exchangeRate: "0.92",
        contactName: "Acme",
        description: "Cloud subscription",
        notes: "First-month free",
      })
      .returning();

    const seed = await loadSeedFromSource(db, orgAId, src.id);
    expect(seed).not.toBeNull();
    expect(seed!.contactName).toBe("Acme");
    expect(seed!.currencyCode).toBe("USD");
    expect(seed!.description).toBe("Cloud subscription");
    expect(seed!.notes).toBe("First-month free");
    // expenseDate, paymentDate, and attachments are intentionally NOT in the seed.
    expect(seed).not.toHaveProperty("expenseDate");
    expect(seed).not.toHaveProperty("paymentDate");
    expect(seed).not.toHaveProperty("attachments");
  });
});
