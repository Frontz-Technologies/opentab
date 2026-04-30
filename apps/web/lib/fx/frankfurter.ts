import {
  SUPPORTED_CURRENCIES,
  type SupportedCurrencyCode,
} from "@/lib/currency/supported";
import type {
  FxProvider,
  FxRateLookup,
  FxRatesAgainstBaseLookup,
} from "./provider";

const BASE_URL = "https://api.frankfurter.dev/v1";

/** Format a Date as YYYY-MM-DD in UTC. Callers must pass a Date that
 *  represents the intended UTC midnight (typically constructed from a
 *  YYYY-MM-DD string via `new Date("2026-01-15T00:00:00Z")`). Passing a
 *  locally-constructed Date near midnight in a non-UTC zone will shift
 *  the resulting URL date. */
function fmtDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

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
    const json = (await res.json()) as {
      amount: number;
      base: string;
      date: string;
      rates: Record<string, number>;
    };
    const rate = json.rates[to];
    if (typeof rate !== "number") {
      throw new Error(`Frankfurter response missing rate for ${to}`);
    }
    return {
      requestedDate: date,
      effectiveDate: new Date(`${json.date}T00:00:00Z`),
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
    const json = (await res.json()) as {
      base: string;
      date: string;
      rates: Record<string, number>;
    };
    if (typeof json.rates !== "object" || json.rates === null) {
      throw new Error("Frankfurter response missing rates object");
    }
    return {
      requestedDate: date,
      effectiveDate: new Date(`${json.date}T00:00:00Z`),
      rates: json.rates,
    };
  }
}
