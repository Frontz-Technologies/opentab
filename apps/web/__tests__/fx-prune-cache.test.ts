import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { createTestDb } from "@opentab/db/test-utils";
import { fxRateCache, expenses } from "@opentab/db/schema";
import { processFxPruneCache } from "../lib/jobs/processors/fx-prune-cache";

describe("processFxPruneCache", () => {
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
  beforeEach(async () => {
    await db.delete(fxRateCache);
  });

  it("deletes only fx_rate_cache rows older than the cutoff", async () => {
    const today = new Date();
    const old = new Date(today.getTime() - 100 * 86_400_000);
    const recent = new Date(today.getTime() - 30 * 86_400_000);

    await db.insert(fxRateCache).values([
      {
        date: old.toISOString().slice(0, 10),
        fromCurrency: "EUR",
        toCurrency: "USD",
        rate: "1.080000000",
        source: "test",
      },
      {
        date: recent.toISOString().slice(0, 10),
        fromCurrency: "EUR",
        toCurrency: "USD",
        rate: "1.090000000",
        source: "test",
      },
    ]);

    await processFxPruneCache({ olderThanDays: 90 }, db);

    const remaining = await db.select().from(fxRateCache);
    expect(remaining).toHaveLength(1);
    expect(remaining[0].date).toBe(recent.toISOString().slice(0, 10));
  });

  it("does not touch other tables (sentinel safety)", async () => {
    const before = await db.select({ id: expenses.id }).from(expenses);
    await processFxPruneCache({ olderThanDays: 90 }, db);
    const after = await db.select({ id: expenses.id }).from(expenses);
    expect(after.length).toBe(before.length);
  });
});
