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
    return {
      requestedDate: date,
      effectiveDate: new Date(`${json.date}T00:00:00Z`),
      rate: json.rates[to],
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
    return {
      requestedDate: date,
      effectiveDate: new Date(`${json.date}T00:00:00Z`),
      rates: json.rates,
    };
  }
}
