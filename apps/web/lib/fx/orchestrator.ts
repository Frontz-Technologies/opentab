import { db as defaultDb } from "@/lib/db";
import type { Db } from "@opentab/db";
import { getActiveFxProvider } from "./registry";
import {
  fmtDate,
  readCache,
  tryCrossRate,
  findRecentFallback,
  writeCache,
} from "./cache/db-cache";
import type { FxRate, FxResult } from "./types";
import type { SupportedCurrencyCode } from "@/lib/currency/supported";

/**
 * Returns the FX rate for `date` from `from` to `to`, querying cache → cross-rate
 * → live provider → stale-fallback in that order. Returns a discriminated outcome
 * — never throws on a missing rate.
 *
 * @example
 *   const r = await getFxRate(new Date("2026-01-15T00:00:00Z"), "EUR", "USD");
 *   if (r.kind === "Hit") use(r.value.rate);
 *   else if (r.kind === "StaleFallbackUsed") use(r.value.rate, { warnDays: r.daysStale });
 *   else displayError(r);
 */
export async function getFxRate(
  date: Date,
  from: SupportedCurrencyCode,
  to: SupportedCurrencyCode,
  dbInstance: Db = defaultDb,
): Promise<FxResult> {
  if (from === to) {
    return {
      kind: "Hit",
      value: { rate: 1, effectiveDate: date, source: "identity" },
    };
  }

  const dateStr = fmtDate(date);

  const direct = await readCache(dbInstance, dateStr, from, to);
  if (direct) {
    return {
      kind: "Hit",
      value: { rate: direct.rate, effectiveDate: date, source: direct.source },
    };
  }

  const cross = await tryCrossRate(dbInstance, dateStr, from, to);
  if (cross) {
    return {
      kind: "Hit",
      value: { rate: cross.rate, effectiveDate: date, source: cross.source },
    };
  }

  const provider = getActiveFxProvider();
  let providerError: string | null = null;
  try {
    const lookup = await provider.getRate(date, from, to);
    await writeCache(
      dbInstance,
      lookup.effectiveDate,
      from,
      to,
      lookup.rate,
      provider.id,
    );
    return {
      kind: "Hit",
      value: {
        rate: lookup.rate,
        effectiveDate: lookup.effectiveDate,
        source: provider.id,
      },
    };
  } catch (err) {
    providerError = err instanceof Error ? err.message : String(err);
  }

  const fallback = await findRecentFallback(dbInstance, date, from, to);
  if (fallback) {
    const daysStale = Math.max(
      0,
      Math.round((date.getTime() - fallback.date.getTime()) / 86_400_000),
    );
    return {
      kind: "StaleFallbackUsed",
      value: {
        rate: fallback.rate,
        effectiveDate: fallback.date,
        source: `stale:${fallback.source}`,
      },
      daysStale,
    };
  }

  if (providerError) {
    if (/timeout|aborted/i.test(providerError)) {
      return { kind: "ProviderTimeout", detail: providerError };
    }
    return { kind: "ProviderBadResponse", detail: providerError };
  }
  return { kind: "NoRateAvailable" };
}

/**
 * Backward-compatible wrapper — returns the rate or throws.
 * Use `getFxRate` (above) when you need to handle stale fallbacks
 * or specific error variants.
 */
export async function getFxRateWithFallback(
  date: Date,
  from: SupportedCurrencyCode,
  to: SupportedCurrencyCode,
  dbInstance: Db = defaultDb,
): Promise<FxRate & { staleFallback: boolean; staleFallbackDate?: Date }> {
  const result = await getFxRate(date, from, to, dbInstance);
  if (result.kind === "Hit") {
    return { ...result.value, staleFallback: false };
  }
  if (result.kind === "StaleFallbackUsed") {
    return {
      ...result.value,
      staleFallback: true,
      staleFallbackDate: result.value.effectiveDate,
    };
  }
  const detail =
    result.kind === "ProviderBadResponse" || result.kind === "ProviderTimeout"
      ? `: ${result.detail ?? "no detail"}`
      : "";
  throw new Error(
    `getFxRate: no rate available for ${from}→${to} on ${fmtDate(date)} (${result.kind}${detail})`,
  );
}
