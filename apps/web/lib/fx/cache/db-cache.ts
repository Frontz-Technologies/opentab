import { and, desc, eq, gte, lte } from "drizzle-orm";
import type { Db } from "@opentab/db";
import { fxRateCache } from "@opentab/db/schema";
import { FX_PIVOT } from "../constants";
import type { SupportedCurrencyCode } from "@/lib/currency";

export const FX_FALLBACK_WINDOW_DAYS = 7;

export function fmtDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export async function readCache(
  db: Db,
  date: string,
  from: SupportedCurrencyCode,
  to: SupportedCurrencyCode,
): Promise<{ rate: number; source: string } | null> {
  const rows = await db
    .select()
    .from(fxRateCache)
    .where(
      and(
        eq(fxRateCache.date, date),
        eq(fxRateCache.fromCurrency, from),
        eq(fxRateCache.toCurrency, to),
      ),
    )
    .limit(1);
  if (rows.length === 0) return null;
  return { rate: parseFloat(rows[0].rate), source: rows[0].source };
}

export async function tryCrossRate(
  db: Db,
  date: string,
  from: SupportedCurrencyCode,
  to: SupportedCurrencyCode,
): Promise<{ rate: number; source: string } | null> {
  if (from === FX_PIVOT || to === FX_PIVOT) return null;
  const eurFrom = await readCache(db, date, FX_PIVOT, from);
  const eurTo = await readCache(db, date, FX_PIVOT, to);
  if (!eurFrom || !eurTo) return null;
  return {
    rate: eurTo.rate / eurFrom.rate,
    source: `cross-rate:${eurFrom.source}+${eurTo.source}`,
  };
}

export async function findRecentFallback(
  db: Db,
  date: Date,
  from: SupportedCurrencyCode,
  to: SupportedCurrencyCode,
): Promise<{ rate: number; date: Date; source: string } | null> {
  const since = new Date(
    date.getTime() - FX_FALLBACK_WINDOW_DAYS * 86_400_000,
  );
  const rows = await db
    .select()
    .from(fxRateCache)
    .where(
      and(
        eq(fxRateCache.fromCurrency, from),
        eq(fxRateCache.toCurrency, to),
        gte(fxRateCache.date, fmtDate(since)),
        lte(fxRateCache.date, fmtDate(date)),
      ),
    )
    .orderBy(desc(fxRateCache.date))
    .limit(1);
  if (rows.length === 0) return null;
  return {
    rate: parseFloat(rows[0].rate),
    date: new Date(`${rows[0].date}T00:00:00Z`),
    source: rows[0].source,
  };
}

/**
 * Write an fx rate to the cache. Idempotent — uses ON CONFLICT DO NOTHING
 * so concurrent fetches and manual seeds are both safe (manual seeds win
 * if they pre-exist).
 */
export async function writeCache(
  db: Db,
  effectiveDate: Date,
  from: SupportedCurrencyCode,
  to: SupportedCurrencyCode,
  rate: number,
  source: string,
): Promise<void> {
  await db
    .insert(fxRateCache)
    .values({
      date: fmtDate(effectiveDate),
      fromCurrency: from,
      toCurrency: to,
      rate: rate.toFixed(9),
      source,
    })
    .onConflictDoNothing();
}
