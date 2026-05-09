import { lt } from "drizzle-orm";
import { db as defaultDb } from "@/lib/db";
import type { Db } from "@opentab/db";
import { fxRateCache } from "@opentab/db/schema";
import { createLogger } from "@/lib/logging";

const log = createLogger("fx-prune-cache");

/**
 * Summary returned by a successful `runPruneCache` call.
 *
 * - `cutoff`: the YYYY-MM-DD date below which rows were deleted.
 * - `olderThanDays`: the input parameter, echoed back for log correlation.
 */
export interface PruneResult {
  cutoff: string;
  olderThanDays: number;
}

/**
 * Deletes fx_rate_cache rows older than `olderThanDays`. Idempotent.
 */
export async function runPruneCache(
  olderThanDays: number,
  dbInstance: Db = defaultDb,
): Promise<PruneResult> {
  const cutoff = new Date(Date.now() - olderThanDays * 86_400_000);
  const cutoffStr = cutoff.toISOString().slice(0, 10);

  await dbInstance.delete(fxRateCache).where(lt(fxRateCache.date, cutoffStr));

  const summary: PruneResult = { cutoff: cutoffStr, olderThanDays };
  log.info("pruned fx_rate_cache", { ...summary });
  return summary;
}
