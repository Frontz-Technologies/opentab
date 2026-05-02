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

  // A poisoned Redis value with ageHours <= 0 makes `cutoff` a future
  // timestamp → every file under every org's tmp/ becomes "older than
  // cutoff" → mass-delete. The processor must reject non-positive
  // (and absurdly large) values before touching the filesystem.
  it("throws on ageHours <= 0 instead of mass-deleting fresh files", async () => {
    const orgDir = join(uploadsDir, "org-1", "expenses", "tmp");
    await mkdir(orgDir, { recursive: true });
    const freshFile = join(orgDir, "fresh.bin");
    await writeFile(freshFile, "fresh");

    const { processCleanupTempFiles } =
      await import("../../../lib/jobs/processors/cleanup-temp-files");

    await expect(processCleanupTempFiles({ ageHours: 0 })).rejects.toThrow();
    await expect(processCleanupTempFiles({ ageHours: -1 })).rejects.toThrow();

    // file untouched after both throw
    const remaining = await readdir(orgDir);
    expect(remaining).toEqual(["fresh.bin"]);
  });

  it("throws on ageHours that is not a finite number", async () => {
    const { processCleanupTempFiles } =
      await import("../../../lib/jobs/processors/cleanup-temp-files");
    await expect(
      processCleanupTempFiles({ ageHours: NaN as unknown as number }),
    ).rejects.toThrow();
    await expect(
      processCleanupTempFiles({
        ageHours: "24" as unknown as number,
      }),
    ).rejects.toThrow();
  });

  it("throws on ageHours larger than 30 days (sanity cap)", async () => {
    const { processCleanupTempFiles } =
      await import("../../../lib/jobs/processors/cleanup-temp-files");
    // 30 days * 24 = 720 — anything strictly greater is rejected.
    await expect(processCleanupTempFiles({ ageHours: 721 })).rejects.toThrow();
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
