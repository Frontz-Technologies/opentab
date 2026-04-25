import { readdir, stat, unlink } from "fs/promises";
import { join } from "path";
import { z } from "zod";
import { createLogger } from "@/lib/logging/logger";

const log = createLogger("job:cleanup-temp-files");

// Boundary validation (tester PR #216 Medium #1). A poisoned Redis
// value with ageHours <= 0 made `cutoff` a future timestamp, causing
// every file under every org's tmp/ to look "older than cutoff" and
// get unlinked. zod-parse rejects that at the door so BullMQ's retry
// + failed-job machinery surfaces it as an alertable failure rather
// than a silent mass-delete. 720h (30 days) cap is a sanity bound.
const cleanupPayloadSchema = z.object({
  ageHours: z.number().finite().int().positive().max(720),
});

// Walks `${UPLOADS_DIR}/<orgId>/expenses/tmp/` for every org and
// deletes files whose mtime is older than ageHours. Quiet on
// missing dirs (an org that never uploaded a temp file has no tmp/).
//
// S3 backend: skipped — bucket lifecycle rules handle tmp expiry on
// S3-hosted deployments. Local FS is the only target here.
export async function processCleanupTempFiles(
  rawPayload: unknown,
): Promise<{ deleted: number }> {
  const { ageHours } = cleanupPayloadSchema.parse(rawPayload);

  if (process.env.S3_ENDPOINT) {
    log.info("S3 backend in use — relying on bucket lifecycle, no-op");
    return { deleted: 0 };
  }

  const uploadsDir = process.env.UPLOADS_DIR || join(process.cwd(), "uploads");
  const cutoff = Date.now() - ageHours * 60 * 60 * 1000;
  let deleted = 0;

  let orgs: string[];
  try {
    orgs = await readdir(uploadsDir);
  } catch {
    return { deleted: 0 };
  }

  for (const org of orgs) {
    const tmpDir = join(uploadsDir, org, "expenses", "tmp");
    let files: string[];
    try {
      files = await readdir(tmpDir);
    } catch {
      continue;
    }
    for (const file of files) {
      const fullPath = join(tmpDir, file);
      try {
        const s = await stat(fullPath);
        if (s.mtimeMs < cutoff) {
          await unlink(fullPath);
          deleted++;
        }
      } catch {
        // file vanished between readdir and stat/unlink — ignore
      }
    }
  }

  log.info("cleanup-temp-files completed", { ageHours, deleted });
  return { deleted };
}
