import {
  PutObjectCommand,
  GetObjectCommand,
  CopyObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "crypto";
import { s3Client, BUCKET } from "@/lib/storage/s3-client";

export async function storeFile(
  orgId: string,
  expenseId: string,
  buffer: Buffer,
  originalName: string,
): Promise<string> {
  const ext = originalName.split(".").pop() || "bin";
  const key = `${orgId}/expenses/${expenseId}.${ext}`;

  await s3Client.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: buffer,
    }),
  );

  return key;
}

export async function getFile(relativePath: string): Promise<Buffer> {
  const response = await s3Client.send(
    new GetObjectCommand({
      Bucket: BUCKET,
      Key: relativePath,
    }),
  );

  const stream = response.Body;
  if (!stream) throw new Error("Empty response body");

  const chunks: Uint8Array[] = [];
  for await (const chunk of stream as AsyncIterable<Uint8Array>) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

export async function getPresignedUrl(
  key: string,
  expiresIn = 3600,
): Promise<string> {
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

  await s3Client.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: buffer,
    }),
  );

  return key;
}

export async function moveTempToExpense(
  tempRelativePath: string,
  orgId: string,
  expenseId: string,
): Promise<string> {
  const ext = tempRelativePath.split(".").pop() || "bin";
  const finalKey = `${orgId}/expenses/${expenseId}.${ext}`;

  await s3Client.send(
    new CopyObjectCommand({
      Bucket: BUCKET,
      CopySource: `${BUCKET}/${tempRelativePath}`,
      Key: finalKey,
    }),
  );

  await s3Client.send(
    new DeleteObjectCommand({
      Bucket: BUCKET,
      Key: tempRelativePath,
    }),
  );

  return finalKey;
}

export async function deleteTempFile(tempRelativePath: string): Promise<void> {
  try {
    await s3Client.send(
      new DeleteObjectCommand({
        Bucket: BUCKET,
        Key: tempRelativePath,
      }),
    );
  } catch {
    // File may already be cleaned up
  }
}
