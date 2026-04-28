import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, readFile, rm, access } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import {
  storeImportTempFile,
  getImportTempFile,
  deleteTempFile,
} from "@/lib/expenses/file-storage";

let dir: string;
const orgId = "org-1";

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "opentab-import-test-"));
  process.env.UPLOADS_DIR = dir;
  // Force the local-FS branch even if the developer's shell has
  // S3_ENDPOINT set (matches cleanup-temp-files test convention).
  delete process.env.S3_ENDPOINT;
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
  delete process.env.UPLOADS_DIR;
});

describe("storeImportTempFile", () => {
  it("writes the buffer to {orgId}/imports/tmp/{importId}.{ext}", async () => {
    const key = await storeImportTempFile(
      orgId,
      "tmp_abc",
      Buffer.from("name,email\nAlice,a@x"),
      "contacts.csv",
    );
    expect(key).toBe("org-1/imports/tmp/tmp_abc.csv");
    const onDisk = await readFile(join(dir, key));
    expect(onDisk.toString()).toBe("name,email\nAlice,a@x");
  });

  it("derives extension from originalName, falls back to bin", async () => {
    const noExt = await storeImportTempFile(
      orgId,
      "tmp_xyz",
      Buffer.from("anything"),
      "uploaded",
    );
    expect(noExt).toBe("org-1/imports/tmp/tmp_xyz.bin");
  });
});

describe("getImportTempFile", () => {
  it("reads back what was stored", async () => {
    const original = Buffer.from("col1,col2\nfoo,bar\n");
    await storeImportTempFile(orgId, "tmp_read", original, "in.csv");
    const got = await getImportTempFile("org-1/imports/tmp/tmp_read.csv");
    expect(got.equals(original)).toBe(true);
  });
});

describe("deleteTempFile", () => {
  it("removes a stored file", async () => {
    const key = await storeImportTempFile(
      orgId,
      "tmp_del",
      Buffer.from("data"),
      "a.csv",
    );
    await deleteTempFile(key);
    await expect(access(join(dir, key))).rejects.toBeDefined();
  });

  it("is idempotent on missing keys", async () => {
    await expect(
      deleteTempFile("org-1/imports/tmp/nonexistent.csv"),
    ).resolves.toBeUndefined();
  });
});
