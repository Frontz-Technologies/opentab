import { randomUUID } from "crypto";
import { createLogger } from "@/lib/logging/logger";

const log = createLogger("file-storage");

const useS3 = !!process.env.S3_ENDPOINT;

// ---------------------------------------------------------------------------
// S3 backend (when S3_ENDPOINT is configured)
// ---------------------------------------------------------------------------

async function s3() {
  const { s3Client, BUCKET } = await import("@/lib/storage/s3-client");
  const {
    PutObjectCommand,
    GetObjectCommand,
    CopyObjectCommand,
    DeleteObjectCommand,
  } = await import("@aws-sdk/client-s3");
  const { getSignedUrl } = await import("@aws-sdk/s3-request-presigner");

  return {
    s3Client,
    BUCKET,
    PutObjectCommand,
    GetObjectCommand,
    CopyObjectCommand,
    DeleteObjectCommand,
    getSignedUrl,
  };
}

// ---------------------------------------------------------------------------
// Local filesystem backend (default — no S3 config needed)
// ---------------------------------------------------------------------------

async function fs() {
  const { mkdir, writeFile, readFile, rename, unlink } =
    await import("fs/promises");
  const { join } = await import("path");
  const uploadsDir = process.env.UPLOADS_DIR || join(process.cwd(), "uploads");
  return { mkdir, writeFile, readFile, rename, unlink, join, uploadsDir };
}

// ---------------------------------------------------------------------------
// Exported API — same signatures regardless of backend
// ---------------------------------------------------------------------------

export async function storeFile(
  orgId: string,
  expenseId: string,
  buffer: Buffer,
  originalName: string,
): Promise<string> {
  const ext = originalName.split(".").pop() || "bin";
  const key = `${orgId}/expenses/${expenseId}.${ext}`;
  const backend = useS3 ? "s3" : "local";

  log.info("storing file", {
    orgId,
    expenseId,
    ext,
    sizeBytes: buffer.length,
    backend,
  });

  if (useS3) {
    const { s3Client, BUCKET, PutObjectCommand } = await s3();
    await s3Client.send(
      new PutObjectCommand({ Bucket: BUCKET, Key: key, Body: buffer }),
    );
  } else {
    const { mkdir, writeFile, join, uploadsDir } = await fs();
    const dir = join(uploadsDir, orgId, "expenses");
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, `${expenseId}.${ext}`), buffer);
  }

  log.debug("file stored", { orgId, expenseId, key, backend });
  return key;
}

export async function getFile(relativePath: string): Promise<Buffer> {
  const backend = useS3 ? "s3" : "local";
  log.debug("retrieving file", { relativePath, backend });

  if (useS3) {
    const { s3Client, BUCKET, GetObjectCommand } = await s3();
    const response = await s3Client.send(
      new GetObjectCommand({ Bucket: BUCKET, Key: relativePath }),
    );
    const stream = response.Body;
    if (!stream) throw new Error("Empty response body");
    const chunks: Uint8Array[] = [];
    for await (const chunk of stream as AsyncIterable<Uint8Array>) {
      chunks.push(chunk);
    }
    return Buffer.concat(chunks);
  } else {
    const { readFile, join, uploadsDir } = await fs();
    return readFile(join(uploadsDir, relativePath));
  }
}

export async function getPresignedUrl(
  key: string,
  expiresIn = 3600,
): Promise<string | null> {
  if (!useS3) return null;
  const { s3Client, BUCKET, GetObjectCommand, getSignedUrl } = await s3();
  return getSignedUrl(
    s3Client,
    new GetObjectCommand({ Bucket: BUCKET, Key: key }),
    { expiresIn },
  );
}

export function generateTempId(): string {
  return `tmp_${randomUUID()}`;
}

export async function storeTempFile(
  orgId: string,
  tempId: string,
  buffer: Buffer,
  originalName: string,
): Promise<string> {
  const ext = originalName.split(".").pop() || "bin";
  const key = `${orgId}/expenses/tmp/${tempId}.${ext}`;
  const backend = useS3 ? "s3" : "local";

  log.info("storing temp file", {
    orgId,
    tempId,
    ext,
    sizeBytes: buffer.length,
    backend,
  });

  if (useS3) {
    const { s3Client, BUCKET, PutObjectCommand } = await s3();
    await s3Client.send(
      new PutObjectCommand({ Bucket: BUCKET, Key: key, Body: buffer }),
    );
  } else {
    const { mkdir, writeFile, join, uploadsDir } = await fs();
    const dir = join(uploadsDir, orgId, "expenses", "tmp");
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, `${tempId}.${ext}`), buffer);
  }

  return key;
}

export async function storeImportTempFile(
  orgId: string,
  importId: string,
  buffer: Buffer,
  originalName: string,
): Promise<string> {
  const ext = originalName.includes(".")
    ? originalName.split(".").pop() || "bin"
    : "bin";
  const key = `${orgId}/imports/tmp/${importId}.${ext}`;
  const backend = useS3 ? "s3" : "local";

  log.info("storing import temp file", {
    orgId,
    importId,
    ext,
    sizeBytes: buffer.length,
    backend,
  });

  if (useS3) {
    const { s3Client, BUCKET, PutObjectCommand } = await s3();
    await s3Client.send(
      new PutObjectCommand({ Bucket: BUCKET, Key: key, Body: buffer }),
    );
  } else {
    const { mkdir, writeFile, join, uploadsDir } = await fs();
    const dir = join(uploadsDir, orgId, "imports", "tmp");
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, `${importId}.${ext}`), buffer);
  }

  return key;
}

export async function getImportTempFile(relativePath: string): Promise<Buffer> {
  return getFile(relativePath);
}

export async function moveTempToExpense(
  tempRelativePath: string,
  orgId: string,
  expenseId: string,
): Promise<string> {
  const ext = tempRelativePath.split(".").pop() || "bin";
  const finalKey = `${orgId}/expenses/${expenseId}.${ext}`;
  const backend = useS3 ? "s3" : "local";

  log.info("moving temp file to expense", {
    orgId,
    expenseId,
    backend,
  });

  if (useS3) {
    const { s3Client, BUCKET, CopyObjectCommand, DeleteObjectCommand } =
      await s3();
    await s3Client.send(
      new CopyObjectCommand({
        Bucket: BUCKET,
        CopySource: `${BUCKET}/${tempRelativePath}`,
        Key: finalKey,
      }),
    );
    await s3Client.send(
      new DeleteObjectCommand({ Bucket: BUCKET, Key: tempRelativePath }),
    );
  } else {
    const { mkdir, rename, join, uploadsDir } = await fs();
    const finalDir = join(uploadsDir, orgId, "expenses");
    await mkdir(finalDir, { recursive: true });
    await rename(
      join(uploadsDir, tempRelativePath),
      join(finalDir, `${expenseId}.${ext}`),
    );
  }

  log.debug("temp file moved", { orgId, expenseId, finalKey });
  return finalKey;
}

// Detects "the file isn't there" across both backends without falling back
// to message-string regex. Local FS throws NodeJS.ErrnoException with
// `code === "ENOENT"`; AWS SDK v3 throws errors with `name === "NoSuchKey"`
// or `"NotFound"` and `$metadata.httpStatusCode === 404`. All four are
// structured fields that the SDKs reliably set — the prior regex on
// `err.message` was paranoia layered on top of the proper checks and is
// dropped to avoid false positives on unrelated errors whose messages
// happen to contain "NotFound".
export function isMissingFileError(err: unknown): boolean {
  const code = (err as NodeJS.ErrnoException).code;
  const name = (err as { name?: string }).name;
  const status = (err as { $metadata?: { httpStatusCode?: number } }).$metadata
    ?.httpStatusCode;
  return (
    code === "ENOENT" ||
    name === "NoSuchKey" ||
    name === "NotFound" ||
    status === 404
  );
}

export async function deleteTempFile(key: string): Promise<void> {
  const backend = useS3 ? "s3" : "local";

  try {
    if (useS3) {
      const { s3Client, BUCKET, DeleteObjectCommand } = await s3();
      await s3Client.send(
        new DeleteObjectCommand({ Bucket: BUCKET, Key: key }),
      );
    } else {
      const { unlink, join, uploadsDir } = await fs();
      await unlink(join(uploadsDir, key));
    }
    log.debug("temp file deleted", { key, backend });
  } catch (err) {
    if (isMissingFileError(err)) return;
    throw err;
  }
}
