import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, mkdir, writeFile, utimes, rm, access } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { processCleanupTempFiles } from "@/lib/jobs/processors/cleanup-temp-files";

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "opentab-cleanup-imports-"));
  process.env.UPLOADS_DIR = dir;
  delete process.env.S3_ENDPOINT;
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
  delete process.env.UPLOADS_DIR;
});

describe("cleanup-temp-files (imports prefix)", () => {
  it("sweeps imports/tmp older than ageHours, leaves fresh files", async () => {
    const orgDir = join(dir, "org-1", "imports", "tmp");
    await mkdir(orgDir, { recursive: true });

    const oldFile = join(orgDir, "tmp_old.csv");
    const freshFile = join(orgDir, "tmp_fresh.csv");
    await writeFile(oldFile, "old");
    await writeFile(freshFile, "fresh");

    const longAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);
    await utimes(oldFile, longAgo, longAgo);

    const result = await processCleanupTempFiles({ ageHours: 24 });

    expect(result.deleted).toBe(1);
    await expect(access(oldFile)).rejects.toBeDefined();
    await expect(access(freshFile)).resolves.toBeUndefined();
  });

  it("sweeps both expenses/tmp and imports/tmp", async () => {
    const expensesDir = join(dir, "org-1", "expenses", "tmp");
    const importsDir = join(dir, "org-1", "imports", "tmp");
    await mkdir(expensesDir, { recursive: true });
    await mkdir(importsDir, { recursive: true });

    const longAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);

    const a = join(expensesDir, "tmp_a.pdf");
    const b = join(importsDir, "tmp_b.csv");
    await writeFile(a, "a");
    await writeFile(b, "b");
    await utimes(a, longAgo, longAgo);
    await utimes(b, longAgo, longAgo);

    const result = await processCleanupTempFiles({ ageHours: 24 });

    expect(result.deleted).toBe(2);
  });
});
