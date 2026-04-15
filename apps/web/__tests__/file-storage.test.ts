import { describe, it, expect, afterEach } from "vitest";
import { mkdir, readFile, writeFile, rm, access } from "fs/promises";
import { join } from "path";
import {
  generateTempId,
  storeTempFile,
  moveTempToExpense,
  deleteTempFile,
} from "../lib/expenses/file-storage";

// The module uses process.cwd()/uploads by default
const UPLOADS_DIR = join(process.cwd(), "uploads");
const TEST_ORG = "test-org-fs";

afterEach(async () => {
  // Clean up test org directory only
  await rm(join(UPLOADS_DIR, TEST_ORG), { recursive: true, force: true });
});

describe("generateTempId", () => {
  it("returns a string starting with tmp_", () => {
    const id = generateTempId();
    expect(id).toMatch(/^tmp_[a-f0-9-]+$/);
  });

  it("generates unique IDs", () => {
    const ids = new Set(Array.from({ length: 10 }, () => generateTempId()));
    expect(ids.size).toBe(10);
  });
});

describe("storeTempFile", () => {
  it("stores a file and returns the relative path", async () => {
    const buffer = Buffer.from("test content");
    const tempId = generateTempId();
    const path = await storeTempFile(TEST_ORG, tempId, buffer, "receipt.pdf");

    expect(path).toBe(`${TEST_ORG}/expenses/tmp/${tempId}.pdf`);

    const stored = await readFile(join(UPLOADS_DIR, path));
    expect(stored.toString()).toBe("test content");
  });

  it("extracts file extension correctly", async () => {
    const buffer = Buffer.from("img");
    const tempId = generateTempId();
    const path = await storeTempFile(TEST_ORG, tempId, buffer, "photo.jpg");
    expect(path).toContain(".jpg");
  });
});

describe("moveTempToExpense", () => {
  it("moves file from temp to final location", async () => {
    // Store a temp file first
    const buffer = Buffer.from("receipt data");
    const tempId = generateTempId();
    const tempPath = await storeTempFile(
      TEST_ORG,
      tempId,
      buffer,
      "receipt.pdf",
    );

    const finalPath = await moveTempToExpense(
      tempPath,
      TEST_ORG,
      "expense-001",
    );

    expect(finalPath).toBe(`${TEST_ORG}/expenses/expense-001.pdf`);

    // Final file exists with correct content
    const content = await readFile(join(UPLOADS_DIR, finalPath));
    expect(content.toString()).toBe("receipt data");

    // Temp file is gone
    await expect(access(join(UPLOADS_DIR, tempPath))).rejects.toThrow();
  });
});

describe("deleteTempFile", () => {
  it("deletes the file from disk", async () => {
    const buffer = Buffer.from("to delete");
    const tempId = generateTempId();
    const tempPath = await storeTempFile(
      TEST_ORG,
      tempId,
      buffer,
      "delete-me.pdf",
    );

    await deleteTempFile(tempPath);

    await expect(access(join(UPLOADS_DIR, tempPath))).rejects.toThrow();
  });

  it("does not throw when file does not exist", async () => {
    await expect(
      deleteTempFile(`${TEST_ORG}/expenses/tmp/nonexistent.pdf`),
    ).resolves.not.toThrow();
  });
});
