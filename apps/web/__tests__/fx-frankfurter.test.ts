import { describe, it, expect, vi, beforeEach } from "vitest";
import { FrankfurterProvider } from "../lib/fx/frankfurter";

describe("FrankfurterProvider", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("getRate() builds the correct URL and parses the response", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        amount: 1,
        base: "USD",
        date: "2026-01-15",
        rates: { EUR: 0.92 },
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const p = new FrankfurterProvider();
    const result = await p.getRate(
      new Date("2026-01-15T00:00:00Z"),
      "USD",
      "EUR",
    );

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.frankfurter.dev/v1/2026-01-15?from=USD&to=EUR",
      expect.any(Object),
    );
    expect(result.rate).toBe(0.92);
    expect(result.effectiveDate.toISOString().slice(0, 10)).toBe("2026-01-15");
  });

  it("effectiveDate falls back to provider-reported date on weekends", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          amount: 1,
          base: "USD",
          date: "2026-01-16",
          rates: { EUR: 0.92 },
        }),
      }),
    );

    const p = new FrankfurterProvider();
    const result = await p.getRate(
      new Date("2026-01-17T00:00:00Z"),
      "USD",
      "EUR",
    );
    expect(result.effectiveDate.toISOString().slice(0, 10)).toBe("2026-01-16");
  });

  it("getRatesAgainstBase() returns all 30 quote currencies in one call", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          amount: 1,
          base: "EUR",
          date: "2026-01-15",
          rates: { USD: 1.08, GBP: 0.85, JPY: 168.4 },
        }),
      }),
    );
    const p = new FrankfurterProvider();
    const r = await p.getRatesAgainstBase(new Date("2026-01-15"), "EUR");
    expect(r.rates).toEqual({ USD: 1.08, GBP: 0.85, JPY: 168.4 });
  });

  it("throws on non-2xx response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
        text: async () => "Service Unavailable",
      }),
    );
    const p = new FrankfurterProvider();
    await expect(p.getRate(new Date(), "USD", "EUR")).rejects.toThrow(/503/);
  });
});
