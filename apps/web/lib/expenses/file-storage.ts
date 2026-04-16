import { mkdir, writeFile, readFile, rename, unlink } from "fs/promises";
import { join } from "path";
import { randomUUID } from "crypto";

const UPLOADS_DIR = process.env.UPLOADS_DIR || join(process.cwd(), "uploads");

export async function storeFile(
  orgId: string,
  expenseId: string,
  buffer: Buffer,
  originalName: string,
): Promise<string> {
  const ext = originalName.split(".").pop() || "bin";
  const dir = join(UPLOADS_DIR, orgId, "expenses");
  await mkdir(dir, { recursive: true });

  const fileName = `${expenseId}.${ext}`;
  const filePath = join(dir, fileName);
  await writeFile(filePath, buffer);

  // Return relative path for DB storage
  return `${orgId}/expenses/${fileName}`;
}

export async function getFile(relativePath: string): Promise<Buffer> {
  const filePath = join(UPLOADS_DIR, relativePath);
  return readFile(filePath);
}

export function getAbsolutePath(relativePath: string): string {
  return join(UPLOADS_DIR, relativePath);
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
  const dir = join(UPLOADS_DIR, orgId, "expenses", "tmp");
  await mkdir(dir, { recursive: true });

  const fileName = `${tempId}.${ext}`;
  const filePath = join(dir, fileName);
  await writeFile(filePath, buffer);

  return `${orgId}/expenses/tmp/${fileName}`;
}

export async function moveTempToExpense(
  tempRelativePath: string,
  orgId: string,
  expenseId: string,
): Promise<string> {
  const ext = tempRelativePath.split(".").pop() || "bin";
  const finalDir = join(UPLOADS_DIR, orgId, "expenses");
  await mkdir(finalDir, { recursive: true });

  const finalFileName = `${expenseId}.${ext}`;
  const finalPath = join(finalDir, finalFileName);
  const tempPath = join(UPLOADS_DIR, tempRelativePath);

  await rename(tempPath, finalPath);
  return `${orgId}/expenses/${finalFileName}`;
}

export async function deleteTempFile(tempRelativePath: string): Promise<void> {
  try {
    await unlink(join(UPLOADS_DIR, tempRelativePath));
  } catch {
    // File may already be cleaned up
  }
}
