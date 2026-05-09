import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
  vi,
} from "vitest";
import { createTestDb } from "@opentab/db/test-utils";
import { fxRateCache } from "@opentab/db/schema";
import { eq } from "drizzle-orm";
import { runPrewarmRates } from "../lib/fx";
import { __setActiveFxProviderForTesting } from "../lib/fx/registry";
import type { FxProvider } from "../lib/fx/provider";

const stubProvider = (impl: Partial<FxProvider> = {}): FxProvider =>
  ({
    id: "stub",
    displayName: "stub",
    hosting: "test",
    supportedCurrencies: new Set(["EUR", "USD", "GBP"]) as any,
    getRate: vi.fn(),
    getRatesAgainstBase: vi.fn(),
    ...impl,
  }) as FxProvider;

describe("runPrewarmRates", () => {
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

  it("inserts one row per quote currency for today's date", async () => {
    __setActiveFxProviderForTesting(
      stubProvider({
        getRatesAgainstBase: vi.fn().mockResolvedValue({
          requestedDate: new Date(),
          effectiveDate: new Date(),
          rates: { USD: 1.08, GBP: 0.85 },
        }),
      }),
    );

    await runPrewarmRates(db);

    const rows = await db
      .select()
      .from(fxRateCache)
      .where(eq(fxRateCache.fromCurrency, "EUR"));
    expect(rows.map((r) => r.toCurrency).sort()).toEqual(["GBP", "USD"]);
  });

  it("re-runs are idempotent (PK conflict handled)", async () => {
    __setActiveFxProviderForTesting(
      stubProvider({
        getRatesAgainstBase: vi.fn().mockResolvedValue({
          requestedDate: new Date(),
          effectiveDate: new Date(),
          rates: { USD: 1.08 },
        }),
      }),
    );

    await runPrewarmRates(db);
    await runPrewarmRates(db);

    const rows = await db.select().from(fxRateCache);
    expect(rows).toHaveLength(1);
  });
});
