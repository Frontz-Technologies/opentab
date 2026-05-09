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
import {
  getFxRate,
  __setActiveFxProviderForTesting,
} from "../lib/fx";
import type { FxProvider } from "../lib/fx";

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

describe("getFxRate error variants", () => {
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

  it("returns ProviderTimeout when the provider rejects with a timeout-flavoured error", async () => {
    __setActiveFxProviderForTesting(
      stubProvider({
        getRate: vi
          .fn()
          .mockRejectedValue(
            new Error("Provider request timeout after 5000ms"),
          ),
      }),
    );

    const result = await getFxRate(
      new Date("2026-01-15T00:00:00Z"),
      "USD",
      "GBP",
      db,
    );

    expect(result.kind).toBe("ProviderTimeout");
    if (result.kind === "ProviderTimeout") {
      expect(result.detail).toContain("timeout");
    }
  });

  it("returns ProviderBadResponse when the provider rejects with a non-timeout error and no fallback exists", async () => {
    __setActiveFxProviderForTesting(
      stubProvider({
        getRate: vi.fn().mockRejectedValue(new Error("provider exhausted")),
      }),
    );

    const result = await getFxRate(
      new Date("2026-01-15T00:00:00Z"),
      "USD",
      "GBP",
      db,
    );

    expect(result.kind).toBe("ProviderBadResponse");
    if (result.kind === "ProviderBadResponse") {
      expect(result.detail).toContain("provider exhausted");
    }
  });
});
