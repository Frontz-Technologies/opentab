import { writeFile, readFile, mkdir } from "fs/promises";
import { join, dirname } from "path";
import { existsSync } from "fs";

const UPLOAD_DIR = process.env.UPLOAD_DIR ?? "./uploads";

export function getUploadDir(): string {
  return UPLOAD_DIR;
}

export function buildExpenseFilePath(
  orgId: string,
  attachmentId: string,
  ext: string,
): string {
  return join(orgId, "expenses", `${attachmentId}.${ext}`);
}

export async function storeFile(
  relativePath: string,
  buffer: Buffer,
): Promise<void> {
  const fullPath = join(UPLOAD_DIR, relativePath);
  const dir = dirname(fullPath);

  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true });
  }

  await writeFile(fullPath, buffer);
}

export async function retrieveFile(relativePath: string): Promise<Buffer> {
  const fullPath = join(UPLOAD_DIR, relativePath);
  return readFile(fullPath);
}

export function getExtensionFromMimeType(mimeType: string): string {
  const mimeMap: Record<string, string> = {
    "application/pdf": "pdf",
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
  };
  return mimeMap[mimeType] ?? "bin";
}

export function isProcessableFile(mimeType: string): boolean {
  const processable = [
    "application/pdf",
    "image/jpeg",
    "image/png",
    "image/webp",
  ];
  return processable.includes(mimeType);
}

export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
