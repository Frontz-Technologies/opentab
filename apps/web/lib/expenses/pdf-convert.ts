import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { writeFile, readFile, unlink, mkdtemp } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

const execFileAsync = promisify(execFile);

/**
 * Convert the first page of a PDF to a PNG image buffer.
 * Uses pdftoppm (poppler-utils), which is installed in the container.
 */
export async function pdfToImage(pdfBuffer: Buffer): Promise<Buffer> {
  const tempDir = await mkdtemp(join(tmpdir(), "opentab-pdf-"));
  const pdfPath = join(tempDir, "input.pdf");
  const outputPrefix = join(tempDir, "page");

  try {
    await writeFile(pdfPath, pdfBuffer);
    await execFileAsync("pdftoppm", [
      "-png",
      "-singlefile", // first page only
      "-r",
      "200", // 200 DPI — good balance of quality vs size
      pdfPath,
      outputPrefix,
    ]);
    const pngPath = `${outputPrefix}.png`;
    return await readFile(pngPath);
  } finally {
    // Clean up temp files
    await unlink(pdfPath).catch(() => {});
    await unlink(`${outputPrefix}.png`).catch(() => {});
  }
}
