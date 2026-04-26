import { spawn } from "node:child_process";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import type { Job } from "bullmq";
import { createLogger } from "@/lib/logging/logger";

const log = createLogger("backup");

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

  const date = new Date().toISOString().slice(0, 10);
  const key = `db/${date}.dump.age`;

  log.info("starting backup", { date, key });

  // Pipe pg_dump → age → buffer (small DBs only; for >1GB, stream directly to s3 via multipart)
  const dump = spawn("pg_dump", ["-Fc", dbUrl]);
  const age = spawn("age", ["-r", agePub, "-o", "/dev/stdout"]);
  dump.stdout.pipe(age.stdin);

  const chunks: Buffer[] = [];
  age.stdout.on("data", (c: Buffer) => chunks.push(c));
  dump.stderr.on("data", (c: Buffer) =>
    log.warn("pg_dump stderr", { msg: c.toString() }),
  );
  age.stderr.on("data", (c: Buffer) =>
    log.warn("age stderr", { msg: c.toString() }),
  );

  await new Promise<void>((resolve, reject) => {
    age.on("close", (code: number) => {
      if (code === 0) resolve();
      else reject(new Error(`age exited with ${code}`));
    });
  });

  const buffer = Buffer.concat(chunks);
  log.info("dump+encrypt complete", { bytes: buffer.length });

  const s3 = new S3Client({
    region,
    endpoint,
    forcePathStyle: true,
    credentials: { accessKeyId: accessKey, secretAccessKey: secretKey },
  });
  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: buffer,
      ContentType: "application/octet-stream",
    }),
  );

  log.info("backup uploaded", { bucket, key });
  return { key };
}
