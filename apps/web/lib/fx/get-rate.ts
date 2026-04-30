import { and, desc, eq, gte, lte } from "drizzle-orm";
import { db as defaultDb } from "@/lib/db";
import { fxRateCache } from "@opentab/db/schema";
import { getActiveFxProvider } from "./registry";
import type { SupportedCurrencyCode } from "@/lib/currency/supported";

const FALLBACK_WINDOW_DAYS = 7;
const PIVOT: SupportedCurrencyCode = "EUR";

type Db = typeof defaultDb;

export interface FxRateResult {
  rate: number;
  /** Date whose ECB rate we used. Equal to the requested date except
   *  when stale-fallback or provider rolled across weekend / holiday. */
  effectiveDate: Date;
  staleFallback: boolean;
  staleFallbackDate?: Date;
  source: string;
}

function fmtDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

async function readCache(
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

async function tryCrossRate(
  db: Db,
  date: string,
  from: SupportedCurrencyCode,
  to: SupportedCurrencyCode,
): Promise<{ rate: number; source: string } | null> {
  if (from === PIVOT || to === PIVOT) return null;
  const eurFrom = await readCache(db, date, PIVOT, from);
  const eurTo = await readCache(db, date, PIVOT, to);
  if (!eurFrom || !eurTo) return null;
  return {
    rate: eurTo.rate / eurFrom.rate,
    source: `cross-rate:${eurFrom.source}+${eurTo.source}`,
  };
}

async function findRecentFallback(
  db: Db,
  date: Date,
  from: SupportedCurrencyCode,
  to: SupportedCurrencyCode,
): Promise<{ rate: number; date: Date; source: string } | null> {
  const since = new Date(date.getTime() - FALLBACK_WINDOW_DAYS * 86_400_000);
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
    // Lazy-fetch is the only writer to fx_rate_cache (cron pre-warm uses
    // the same path). Concurrent fetches for the same (date, from, to) all
    // resolve to the same provider rate, so silently dropping the duplicate
    // is safe. If a manual seed pre-exists, the seed wins — that's intentional.
    await dbInstance
      .insert(fxRateCache)
      .values({
        date: fmtDate(lookup.effectiveDate),
        fromCurrency: from,
        toCurrency: to,
        rate: lookup.rate.toFixed(9),
        source: provider.id,
      })
      .onConflictDoNothing();
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
