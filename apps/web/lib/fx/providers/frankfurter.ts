import { z } from "zod";
import {
  SUPPORTED_CURRENCIES,
  type SupportedCurrencyCode,
} from "@/lib/currency/supported";
import type {
  FxProvider,
  FxRateLookup,
  FxRatesAgainstBaseLookup,
} from "../provider";

const BASE_URL = "https://api.frankfurter.dev/v1";

/** Format a Date as YYYY-MM-DD in UTC. Callers must pass a Date that
 *  represents the intended UTC midnight. */
function fmtDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

const FrankfurterRateResponse = z.object({
  amount: z.number(),
  base: z.string(),
  date: z.string(),
  // Accept any number-typed value here (including NaN/Infinity); the
  // runtime guards below reject non-finite-positive rates with a more
  // specific error message. Zod v4's `z.number()` rejects NaN/Infinity
  // by default, which would mask those guards.
  rates: z.record(
    z.string(),
    z.custom<number>((v) => typeof v === "number"),
  ),
});

const FrankfurterRatesAgainstBaseResponse = z.object({
  base: z.string(),
  date: z.string(),
  // Accept any number-typed value here (including NaN/Infinity); the
  // runtime guards below reject non-finite-positive rates with a more
  // specific error message. Zod v4's `z.number()` rejects NaN/Infinity
  // by default, which would mask those guards.
  rates: z.record(
    z.string(),
    z.custom<number>((v) => typeof v === "number"),
  ),
});

export class FrankfurterProvider implements FxProvider {
  readonly id = "frankfurter";
  readonly displayName = "ECB / Frankfurter";
  readonly hosting = "Germany (EU)";
  readonly supportedCurrencies = new Set(
    SUPPORTED_CURRENCIES.map((c) => c.code),
  ) as ReadonlySet<SupportedCurrencyCode>;

  async getRate(
    date: Date,
    from: SupportedCurrencyCode,
    to: SupportedCurrencyCode,
  ): Promise<FxRateLookup> {
    const url = `${BASE_URL}/${fmtDate(date)}?from=${from}&to=${to}`;
    const res = await fetch(url, { headers: { accept: "application/json" } });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Frankfurter ${res.status}: ${body.slice(0, 200)}`);
    }
    const raw: unknown = await res.json();
    const decoded = FrankfurterRateResponse.safeParse(raw);
    if (!decoded.success) {
      const detail = decoded.error.issues
        .map((i) => i.path.join("."))
        .join(",");
      throw new Error(
        `Frankfurter response invalid: ${detail || "schema mismatch"}`,
      );
    }
    const rate = decoded.data.rates[to];
    if (!Number.isFinite(rate) || rate <= 0) {
      throw new Error(
        `Frankfurter response invalid rate for ${to}: ${JSON.stringify(rate)}`,
      );
    }
    return {
      requestedDate: date,
      effectiveDate: new Date(`${decoded.data.date}T00:00:00Z`),
      rate,
    };
  }

  async getRatesAgainstBase(
    date: Date,
    base: SupportedCurrencyCode,
  ): Promise<FxRatesAgainstBaseLookup> {
    const quote = SUPPORTED_CURRENCIES.map((c) => c.code)
      .filter((c) => c !== base)
      .join(",");
    const url = `${BASE_URL}/${fmtDate(date)}?from=${base}&to=${quote}`;
    const res = await fetch(url, { headers: { accept: "application/json" } });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Frankfurter ${res.status}: ${body.slice(0, 200)}`);
    }
    const raw: unknown = await res.json();
    const decoded = FrankfurterRatesAgainstBaseResponse.safeParse(raw);
    if (!decoded.success) {
      const detail = decoded.error.issues
        .map((i) => i.path.join("."))
        .join(",");
      throw new Error(
        `Frankfurter response invalid: ${detail || "schema mismatch"}`,
      );
    }
    if (!hasAtLeastOneFinitePositiveRate(decoded.data.rates)) {
      throw new Error(
        "Frankfurter response rates object has no finite positive rate",
      );
    }
    return {
      requestedDate: date,
      effectiveDate: new Date(`${decoded.data.date}T00:00:00Z`),
      rates: decoded.data.rates,
    };
  }
}

function hasAtLeastOneFinitePositiveRate(
  rates: Record<string, unknown>,
): boolean {
  for (const v of Object.values(rates)) {
    if (typeof v === "number" && Number.isFinite(v) && v > 0) return true;
  }
  return false;
}
