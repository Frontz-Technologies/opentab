import { db as defaultDb } from "@/lib/db";
import type { Db } from "@opentab/db";
import { fxRateCache } from "@opentab/db/schema";
import { createLogger } from "@/lib/logging";
import { getActiveFxProvider } from "../registry";
import { FX_PIVOT } from "../constants";
import { fmtDate } from "../cache/db-cache";

const log = createLogger("fx-prewarm-rates");

export interface PrewarmResult {
  count: number;
  date: string;
  provider: string;
}

/**
 * Pre-warms the fx rate cache for today by fetching ECB rates against EUR
 * and inserting one row per quote currency. Idempotent — re-runs use ON
 * CONFLICT DO NOTHING so concurrent invocations are safe.
 *
 * @throws if the provider returns no rates (signals an upstream outage).
 */
export async function runPrewarmRates(
  dbInstance: Db = defaultDb,
): Promise<PrewarmResult> {
  const provider = getActiveFxProvider();
  const today = new Date();
  const lookup = await provider.getRatesAgainstBase(today, FX_PIVOT);

  const rows = Object.entries(lookup.rates).map(([toCurrency, rate]) => ({
    date: fmtDate(lookup.effectiveDate),
    fromCurrency: FX_PIVOT,
    toCurrency,
    rate: rate.toFixed(9),
    source: provider.id,
  }));

  if (rows.length === 0) {
    throw new Error(
      `fx-prewarm-rates: provider ${provider.id} returned no rates`,
    );
  }

  await dbInstance.insert(fxRateCache).values(rows).onConflictDoNothing();
  const summary: PrewarmResult = {
    count: rows.length,
    date: fmtDate(lookup.effectiveDate),
    provider: provider.id,
  };
  log.info("prewarmed FX rates", { ...summary });
  return summary;
}
