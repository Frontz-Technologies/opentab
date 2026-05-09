import { db as defaultDb } from "@/lib/db";
import type { Db } from "@opentab/db";
import { runPruneCache } from "@/lib/fx";
import type { JobPayload } from "../types";
import { QUEUE } from "../types";

export async function processFxPruneCache(
  payload: JobPayload<typeof QUEUE.FX_PRUNE_CACHE>,
  dbInstance: Db = defaultDb,
): Promise<void> {
  await runPruneCache(payload.olderThanDays, dbInstance);
}
