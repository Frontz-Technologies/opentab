import { db as defaultDb } from "@/lib/db";
import { fxRateCache } from "@opentab/db/schema";
import { getActiveFxProvider } from "@/lib/fx/registry";
import { createLogger } from "@/lib/logging/logger";
import type { JobPayload } from "../types";
import { QUEUE } from "../types";

const log = createLogger("fx-prewarm-rates");
const PIVOT = "EUR" as const;

type Db = typeof defaultDb;

function fmtDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export async function processFxPrewarmRates(
  _payload: JobPayload<typeof QUEUE.FX_PREWARM_RATES>,
  dbInstance: Db = defaultDb,
): Promise<void> {
  const provider = getActiveFxProvider();
  const today = new Date();
  const lookup = await provider.getRatesAgainstBase(today, PIVOT);

  const rows = Object.entries(lookup.rates).map(([toCurrency, rate]) => ({
    date: fmtDate(lookup.effectiveDate),
    fromCurrency: PIVOT,
    toCurrency,
    rate: rate.toFixed(9),
    source: provider.id,
  }));

  if (rows.length === 0) {
    log.warn("provider returned no rates", { provider: provider.id });
    return;
  }

  await dbInstance.insert(fxRateCache).values(rows).onConflictDoNothing();
  log.info("prewarmed FX rates", {
    count: rows.length,
    date: fmtDate(lookup.effectiveDate),
    provider: provider.id,
  });
}
