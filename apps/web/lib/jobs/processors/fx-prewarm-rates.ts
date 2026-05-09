import { db as defaultDb } from "@/lib/db";
import type { Db } from "@opentab/db";
import { runPrewarmRates } from "@/lib/fx";
import type { JobPayload } from "../types";
import { QUEUE } from "../types";

export async function processFxPrewarmRates(
  _payload: JobPayload<typeof QUEUE.FX_PREWARM_RATES>,
  dbInstance: Db = defaultDb,
): Promise<void> {
  await runPrewarmRates(dbInstance);
}
