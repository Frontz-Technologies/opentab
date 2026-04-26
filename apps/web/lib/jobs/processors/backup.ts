import { spawn } from "node:child_process";
import { S3Client } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import type { Job } from "bullmq";
import { createLogger } from "@/lib/logging/logger";

const log = createLogger("backup");

/**
 * Validate that BACKUP_AGE_PUBLIC_KEY is parseable by `age` itself.
 * Spawns `age -r <key> -o /dev/null` with empty stdin: exit 0 means the
 * recipient string is well-formed. Anything else (incl. ENOENT for missing
 * binary) rejects with a clear error.
 */
function validateAgePublicKey(key: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn("age", ["-r", key, "-o", "/dev/null"]);
    let stderr = "";
    proc.stderr.on("data", (c: Buffer) => {
      stderr += c.toString();
    });
    proc.on("error", (err) => {
      reject(
        new Error(
          `failed to spawn age for key validation: ${(err as Error).message}`,
        ),
      );
    });
    proc.on("close", (code: number | null) => {
      if (code === 0) resolve();
      else
        reject(
          new Error(
            `invalid age recipient (exit ${code ?? "?"}): ${stderr.trim() || "no stderr"}`,
          ),
        );
    });
    // empty stdin → age has nothing to encrypt, just validates the recipient
    proc.stdin.end();
  });
}

function waitForExit(
  proc: ReturnType<typeof spawn>,
  name: string,
): Promise<void> {
  return new Promise((resolve, reject) => {
    let errored = false;
    proc.on("error", (err) => {
      errored = true;
      reject(new Error(`failed to spawn ${name}: ${(err as Error).message}`));
    });
    proc.on("close", (code: number | null) => {
      if (errored) return;
      if (code === 0) resolve();
      else reject(new Error(`${name} exited with ${code ?? "?"}`));
    });
  });
}

function timestampSlug(): string {
  // YYYY-MM-DD-HH-mm-ss in UTC, slugified from ISO 8601
  const iso = new Date().toISOString();
  // 2026-04-26T15:34:09.123Z → 2026-04-26-15-34-09
  return iso.slice(0, 19).replace("T", "-").replace(/:/g, "-");
}

export async function processBackup(_job: Job): Promise<{ key: string }> {
  const dbUrl = process.env.DATABASE_URL;
  const bucket = process.env.BACKUP_S3_BUCKET;
  const region = process.env.BACKUP_S3_REGION;
  const endpoint = process.env.BACKUP_S3_ENDPOINT;
  const accessKey = process.env.BACKUP_S3_ACCESS_KEY;
  const secretKey = process.env.BACKUP_S3_SECRET_KEY;
  const agePub = process.env.BACKUP_AGE_PUBLIC_KEY;

  if (!dbUrl) throw new Error("DATABASE_URL is not set");
  if (!bucket) throw new Error("BACKUP_S3_BUCKET is not set");
  if (!region) throw new Error("BACKUP_S3_REGION is not set");
  if (!endpoint) throw new Error("BACKUP_S3_ENDPOINT is not set");
  if (!accessKey) throw new Error("BACKUP_S3_ACCESS_KEY is not set");
  if (!secretKey) throw new Error("BACKUP_S3_SECRET_KEY is not set");
  if (!agePub) throw new Error("BACKUP_AGE_PUBLIC_KEY is not set");

  // Fail fast if the recipient string is malformed — saves us spinning up
  // pg_dump on a doomed run.
  await validateAgePublicKey(agePub);

  const slug = timestampSlug();
  const key = `db/${slug}.dump.age`;

  log.info("starting backup", { slug, key });

  // pg_dump → age → S3 (streamed end-to-end, constant memory)
  const dump = spawn("pg_dump", ["-Fc", dbUrl]);
  const age = spawn("age", ["-r", agePub, "-o", "/dev/stdout"]);

  dump.stderr.on("data", (c: Buffer) =>
    log.warn("pg_dump stderr", { msg: c.toString() }),
  );
  age.stderr.on("data", (c: Buffer) =>
    log.warn("age stderr", { msg: c.toString() }),
  );

  // Wire pg_dump → age. Watch for stdin write errors so a broken pipe
  // doesn't leave us hanging.
  dump.stdout.on("error", (err) =>
    log.warn("pg_dump stdout error", { msg: (err as Error).message }),
  );
  age.stdin.on("error", (err) =>
    log.warn("age stdin error", { msg: (err as Error).message }),
  );
  dump.stdout.pipe(age.stdin);

  const dumpDone = waitForExit(dump, "pg_dump");
  const ageDone = waitForExit(age, "age");

  const s3 = new S3Client({
    region,
    endpoint,
    forcePathStyle: true,
    credentials: { accessKeyId: accessKey, secretAccessKey: secretKey },
  });

  const upload = new Upload({
    client: s3,
    params: {
      Bucket: bucket,
      Key: key,
      Body: age.stdout,
      ContentType: "application/octet-stream",
    },
  });

  // If ANY of the three legs fails, the whole job fails. Promise.all rejects
  // on first error and we surface it directly.
  await Promise.all([dumpDone, ageDone, upload.done()]);

  log.info("backup uploaded", { bucket, key });
  return { key };
}
