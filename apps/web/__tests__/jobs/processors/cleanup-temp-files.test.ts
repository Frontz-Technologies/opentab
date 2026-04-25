import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, writeFile, mkdir, utimes, readdir, rm } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";

describe("cleanup-temp-files processor (#85)", () => {
  let uploadsDir: string;

  beforeEach(async () => {
    uploadsDir = await mkdtemp(join(tmpdir(), "opentab-cleanup-test-"));
    process.env.UPLOADS_DIR = uploadsDir;
    delete process.env.S3_ENDPOINT;
  });

  afterEach(async () => {
    await rm(uploadsDir, { recursive: true, force: true });
  });

  it("deletes temp files older than ageHours and leaves fresh ones", async () => {
    const orgDir = join(uploadsDir, "org-1", "expenses", "tmp");
    await mkdir(orgDir, { recursive: true });
    const oldFile = join(orgDir, "old.bin");
    const freshFile = join(orgDir, "fresh.bin");
    await writeFile(oldFile, "old");
    await writeFile(freshFile, "fresh");
    // Backdate the old file 25h
    const old = new Date(Date.now() - 25 * 60 * 60 * 1000);
    await utimes(oldFile, old, old);

    const { processCleanupTempFiles } =
      await import("../../../lib/jobs/processors/cleanup-temp-files");
    const result = await processCleanupTempFiles({ ageHours: 24 });

    expect(result.deleted).toBe(1);
    const remaining = await readdir(orgDir);
    expect(remaining).toEqual(["fresh.bin"]);
  });

  it("returns deleted=0 on a missing uploads dir", async () => {
    process.env.UPLOADS_DIR = join(uploadsDir, "no-such-dir");
    const { processCleanupTempFiles } =
      await import("../../../lib/jobs/processors/cleanup-temp-files");
    const result = await processCleanupTempFiles({ ageHours: 24 });
    expect(result.deleted).toBe(0);
  });

  it("returns deleted=0 on an org with no tmp/ subdirectory", async () => {
    await mkdir(join(uploadsDir, "org-1"), { recursive: true });
    const { processCleanupTempFiles } =
      await import("../../../lib/jobs/processors/cleanup-temp-files");
    const result = await processCleanupTempFiles({ ageHours: 24 });
    expect(result.deleted).toBe(0);
  });

  it("no-ops when S3_ENDPOINT is set (bucket lifecycle owns expiry)", async () => {
    process.env.S3_ENDPOINT = "https://s3.example.com";
    const orgDir = join(uploadsDir, "org-1", "expenses", "tmp");
    await mkdir(orgDir, { recursive: true });
    const oldFile = join(orgDir, "old.bin");
    await writeFile(oldFile, "old");
    const old = new Date(Date.now() - 25 * 60 * 60 * 1000);
    await utimes(oldFile, old, old);

    const { processCleanupTempFiles } =
      await import("../../../lib/jobs/processors/cleanup-temp-files");
    const result = await processCleanupTempFiles({ ageHours: 24 });

    expect(result.deleted).toBe(0);
    // file untouched
    const remaining = await readdir(orgDir);
    expect(remaining).toEqual(["old.bin"]);
  });
});
