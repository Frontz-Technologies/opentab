import { mkdir, writeFile, readFile } from "fs/promises";
import { join } from "path";

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
