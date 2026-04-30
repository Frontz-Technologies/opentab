// Worker entrypoint — run as a separate Node process via
// `pnpm --filter @opentab/web worker` (dev) or in the docker-compose
// worker service (prod). Connects to Redis, registers the repeatable
// cleanup job idempotently, and processes both queues.

import { config } from "dotenv";
config({ path: ".env.local" });
config(); // .env

import { Worker, Queue } from "bullmq";
import { QUEUE } from "./lib/jobs/types";
import { getRedisConnection, getRegisteredQueues } from "./lib/jobs/queues";
import { processCleanupTempFiles } from "./lib/jobs/processors/cleanup-temp-files";
import { processDeleteExpenseFiles } from "./lib/jobs/processors/delete-expense-files";
import { processBackup } from "./lib/jobs/processors/backup";
import { processFxPrewarmRates } from "./lib/jobs/processors/fx-prewarm-rates";
import { createLogger } from "./lib/logging/logger";

const log = createLogger("worker");

async function registerRepeatables() {
  // Touch the queue so we can schedule the repeatable on it. The
  // deterministic jobId means re-registering on each worker boot is
  // a no-op in BullMQ — the existing repeatable is reused.
  const cleanup = new Queue(QUEUE.CLEANUP_TEMP_FILES, {
    connection: getRedisConnection(),
  });
  await cleanup.add(
    QUEUE.CLEANUP_TEMP_FILES,
    { ageHours: 24 },
    {
      repeat: { every: 24 * 60 * 60 * 1000 }, // 24h
      jobId: "cleanup-temp-files-daily",
    },
  );
  log.info("registered repeatable cleanup-temp-files (every 24h)");

  // Nightly age-encrypted pg_dump → S3. 00:00 UTC = 03:00 Athens.
  // Only registered when the operator has opted in by providing an age
  // public key — self-hosters who don't want managed backups skip this.
  if (process.env.BACKUP_AGE_PUBLIC_KEY) {
    const backup = new Queue(QUEUE.BACKUP, {
      connection: getRedisConnection(),
    });
    await backup.add(
      "nightly",
      {},
      {
        repeat: { pattern: "0 0 * * *" },
        jobId: "nightly-backup",
      },
    );
    log.info("registered repeatable backup (nightly 00:00 UTC)");
  } else {
    log.info("skipping backup registration — BACKUP_AGE_PUBLIC_KEY unset");
  }

  const fxPrewarm = new Queue(QUEUE.FX_PREWARM_RATES, {
    connection: getRedisConnection(),
  });
  await fxPrewarm.add(
    QUEUE.FX_PREWARM_RATES,
    {},
    {
      repeat: { pattern: "0 17 * * *" }, // 17:00 daily — after ECB publishes
      jobId: "fx-prewarm-rates-daily",
    },
  );
  log.info("registered repeatable fx-prewarm-rates (daily 17:00)");
}

async function main() {
  log.info("worker starting", {
    redisUrl: process.env.REDIS_URL ? "set" : "MISSING",
  });

  await registerRepeatables();

  const workers: Worker[] = [
    new Worker(
      QUEUE.CLEANUP_TEMP_FILES,
      async (job) => processCleanupTempFiles(job.data),
      { connection: getRedisConnection() },
    ),
    new Worker(
      QUEUE.DELETE_EXPENSE_FILES,
      async (job) => processDeleteExpenseFiles(job.data),
      { connection: getRedisConnection() },
    ),
    new Worker(QUEUE.FX_PREWARM_RATES, async () => processFxPrewarmRates({}), {
      connection: getRedisConnection(),
    }),
    ...(process.env.BACKUP_AGE_PUBLIC_KEY
      ? [
          new Worker(QUEUE.BACKUP, processBackup, {
            connection: getRedisConnection(),
          }),
        ]
      : []),
  ];

  for (const w of workers) {
    w.on("completed", (job) => {
      log.info("job completed", {
        queue: w.name,
        jobId: job.id,
        attempts: job.attemptsMade,
        durationMs: job.processedOn ? Date.now() - job.processedOn : 0,
      });
    });
    w.on("failed", (job, err) => {
      log.error("job failed", {
        queue: w.name,
        jobId: job?.id,
        attempts: job?.attemptsMade,
        errorMessage: err.message,
      });
    });
  }

  log.info("worker ready", { queues: workers.map((w) => w.name) });

  const shutdown = async () => {
    log.info("worker shutting down");
    for (const w of workers) await w.close();
    for (const q of getRegisteredQueues()) await q.close();
    process.exit(0);
  };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

main().catch((err) => {
  log.error("worker fatal", {
    errorMessage: err instanceof Error ? err.message : String(err),
  });
  process.exit(1);
});
