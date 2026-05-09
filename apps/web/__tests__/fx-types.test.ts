import { describe, it, expect } from "vitest";
import type { FxRate, FxResult, FxError } from "../lib/fx/types";

describe("fx types", () => {
  it("FxResult Hit carries an FxRate", () => {
    const rate: FxRate = {
      rate: 1.08,
      effectiveDate: new Date("2026-01-15T00:00:00Z"),
      source: "frankfurter",
    };
    const result: FxResult = { kind: "Hit", value: rate };
    if (result.kind === "Hit") {
      expect(result.value.rate).toBe(1.08);
    } else {
      throw new Error("expected Hit");
    }
  });

  it("FxResult StaleFallbackUsed carries daysStale alongside the rate", () => {
    const result: FxResult = {
      kind: "StaleFallbackUsed",
      value: {
        rate: 1.07,
        effectiveDate: new Date("2026-01-10T00:00:00Z"),
        source: "stale:frankfurter",
      },
      daysStale: 5,
    };
    if (result.kind === "StaleFallbackUsed") {
      expect(result.daysStale).toBe(5);
    } else {
      throw new Error("expected StaleFallbackUsed");
    }
  });

  it("FxError covers ProviderTimeout, ProviderBadResponse, NoRateAvailable", () => {
    const errors: FxError[] = [
      { kind: "ProviderTimeout" },
      { kind: "ProviderBadResponse", detail: "rates.USD missing" },
      { kind: "NoRateAvailable" },
    ];
    expect(errors).toHaveLength(3);
  });
});
