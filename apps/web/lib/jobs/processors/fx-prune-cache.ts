import { lt } from "drizzle-orm";
import { db as defaultDb } from "@/lib/db";
import type { Db } from "@opentab/db";
import { fxRateCache } from "@opentab/db/schema";
import { createLogger } from "@/lib/logging/logger";
import type { JobPayload } from "../types";
import { QUEUE } from "../types";

const log = createLogger("fx-prune-cache");

export async function processFxPruneCache(
  payload: JobPayload<typeof QUEUE.FX_PRUNE_CACHE>,
  dbInstance: Db = defaultDb,
): Promise<void> {
  const cutoff = new Date(Date.now() - payload.olderThanDays * 86_400_000);
  const cutoffStr = cutoff.toISOString().slice(0, 10);

  await dbInstance.delete(fxRateCache).where(lt(fxRateCache.date, cutoffStr));

  log.info("pruned fx_rate_cache", {
    cutoff: cutoffStr,
    olderThanDays: payload.olderThanDays,
  });
}
