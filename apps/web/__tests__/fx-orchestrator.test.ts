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
import { eq, and } from "drizzle-orm";
import { getFxRate, getFxRateWithFallback } from "../lib/fx/orchestrator";
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

describe("getFxRate", () => {
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
    __setActiveFxProviderForTesting(null);
  });

  it("returns 1.0 immediately when from == to (no DB hit, no provider hit)", async () => {
    const provider = stubProvider({
      getRate: vi.fn().mockRejectedValue(new Error("must not be called")),
    });
    __setActiveFxProviderForTesting(provider);
    const r = await getFxRate(new Date("2026-01-15"), "EUR", "EUR", db);
    expect(r.kind).toBe("Hit");
    if (r.kind === "Hit") expect(r.value.rate).toBe(1);
    expect(provider.getRate).not.toHaveBeenCalled();
  });

  it("hits the cache when (date, from, to) is present", async () => {
    await db.insert(fxRateCache).values({
      date: "2026-01-15",
      fromCurrency: "USD",
      toCurrency: "EUR",
      rate: "0.920000000",
      source: "test-seed",
    });
    const provider = stubProvider({
      getRate: vi.fn().mockRejectedValue(new Error("must not be called")),
    });
    __setActiveFxProviderForTesting(provider);

    const r = await getFxRate(new Date("2026-01-15"), "USD", "EUR", db);
    expect(r.kind).toBe("Hit");
    if (r.kind === "Hit") expect(r.value.rate).toBe(0.92);
    expect(provider.getRate).not.toHaveBeenCalled();
  });

  it("computes cross-rate via the EUR pivot when both legs are cached", async () => {
    await db.insert(fxRateCache).values([
      {
        date: "2026-01-15",
        fromCurrency: "EUR",
        toCurrency: "USD",
        rate: "1.080000000",
        source: "test-seed",
      },
      {
        date: "2026-01-15",
        fromCurrency: "EUR",
        toCurrency: "GBP",
        rate: "0.850000000",
        source: "test-seed",
      },
    ]);
    const provider = stubProvider({
      getRate: vi.fn().mockRejectedValue(new Error("must not be called")),
    });
    __setActiveFxProviderForTesting(provider);

    const r = await getFxRate(new Date("2026-01-15"), "USD", "GBP", db);
    expect(r.kind).toBe("Hit");
    if (r.kind === "Hit") expect(r.value.rate).toBeCloseTo(0.85 / 1.08, 6);
  });

  it("lazy-fetches via provider on cache miss + cross-rate miss", async () => {
    const provider = stubProvider({
      getRate: vi.fn().mockResolvedValue({
        requestedDate: new Date("2026-01-15"),
        effectiveDate: new Date("2026-01-15"),
        rate: 0.92,
      }),
    });
    __setActiveFxProviderForTesting(provider);

    const r = await getFxRate(new Date("2026-01-15"), "USD", "EUR", db);
    expect(r.kind).toBe("Hit");
    if (r.kind === "Hit") expect(r.value.rate).toBe(0.92);
    expect(provider.getRate).toHaveBeenCalledOnce();

    const rows = await db
      .select()
      .from(fxRateCache)
      .where(
        and(
          eq(fxRateCache.date, "2026-01-15"),
          eq(fxRateCache.fromCurrency, "USD"),
          eq(fxRateCache.toCurrency, "EUR"),
        ),
      );
    expect(rows).toHaveLength(1);
    expect(parseFloat(rows[0].rate)).toBe(0.92);
  });

  it("falls back to the most-recent (≤7 days) cached rate when provider fails", async () => {
    await db.insert(fxRateCache).values({
      date: "2026-01-10",
      fromCurrency: "USD",
      toCurrency: "EUR",
      rate: "0.910000000",
      source: "test-seed",
    });
    const provider = stubProvider({
      getRate: vi.fn().mockRejectedValue(new Error("Frankfurter 503")),
    });
    __setActiveFxProviderForTesting(provider);

    const r = await getFxRate(new Date("2026-01-15"), "USD", "EUR", db);
    expect(r.kind).toBe("StaleFallbackUsed");
    if (r.kind === "StaleFallbackUsed") {
      expect(r.value.rate).toBe(0.91);
      expect(r.value.effectiveDate.toISOString().slice(0, 10)).toBe(
        "2026-01-10",
      );
    }
  });

  it("returns an error variant when provider fails AND no recent cached rate exists", async () => {
    const provider = stubProvider({
      getRate: vi.fn().mockRejectedValue(new Error("Frankfurter 503")),
    });
    __setActiveFxProviderForTesting(provider);

    const r = await getFxRate(new Date("2026-01-15"), "USD", "EUR", db);
    expect([
      "NoRateAvailable",
      "ProviderBadResponse",
      "ProviderTimeout",
    ]).toContain(r.kind);
  });

  it("getFxRateWithFallback throws when no rate is available (legacy semantics)", async () => {
    __setActiveFxProviderForTesting(
      stubProvider({
        getRate: vi.fn().mockRejectedValue(new Error("Frankfurter 503")),
      }),
    );
    await expect(
      getFxRateWithFallback(new Date("2026-01-15"), "USD", "EUR", db),
    ).rejects.toThrow();
  });
});
