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
import type { SupportedCurrencyCode } from "@/lib/currency/supported";

export interface FxRateResult {
  rate: number;
  /** Date whose ECB rate we used. Equal to the requested date except
   *  when stale-fallback or provider rolled across weekend / holiday. */
  effectiveDate: Date;
  staleFallback: boolean;
  staleFallbackDate?: Date;
  source: string;
}

export async function getFxRate(
  date: Date,
  from: SupportedCurrencyCode,
  to: SupportedCurrencyCode,
  dbInstance: Db = defaultDb,
): Promise<FxRateResult> {
  if (from === to) {
    return {
      rate: 1,
      effectiveDate: date,
      staleFallback: false,
      source: "identity",
    };
  }

  const dateStr = fmtDate(date);

  const direct = await readCache(dbInstance, dateStr, from, to);
  if (direct) {
    return {
      rate: direct.rate,
      effectiveDate: date,
      staleFallback: false,
      source: direct.source,
    };
  }

  const cross = await tryCrossRate(dbInstance, dateStr, from, to);
  if (cross) {
    return {
      rate: cross.rate,
      effectiveDate: date,
      staleFallback: false,
      source: cross.source,
    };
  }

  const provider = getActiveFxProvider();
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
      rate: lookup.rate,
      effectiveDate: lookup.effectiveDate,
      staleFallback: false,
      source: provider.id,
    };
  } catch (err) {
    const fallback = await findRecentFallback(dbInstance, date, from, to);
    if (fallback) {
      return {
        rate: fallback.rate,
        effectiveDate: fallback.date,
        staleFallback: true,
        staleFallbackDate: fallback.date,
        source: `stale:${fallback.source}`,
      };
    }
    throw new Error(
      `getFxRate: no rate available for ${from}→${to} on ${dateStr} ` +
        `and provider failed (${err instanceof Error ? err.message : String(err)})`,
    );
  }
}
