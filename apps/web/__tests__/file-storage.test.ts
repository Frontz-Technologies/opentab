import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  generateTempId,
  storeTempFile,
  moveTempToExpense,
  deleteTempFile,
  storeFile,
  getFile,
  getPresignedUrl,
} from "../lib/expenses/file-storage";

// Mock the S3 client module
vi.mock("../lib/storage/s3-client", () => ({
  s3Client: { send: vi.fn() },
  BUCKET: "test-bucket",
}));

// Mock the presigner
vi.mock("@aws-sdk/s3-request-presigner", () => ({
  getSignedUrl: vi.fn().mockResolvedValue("https://s3.example.com/signed-url"),
}));

import { s3Client } from "../lib/storage/s3-client";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const mockSend = vi.mocked(s3Client.send);

beforeEach(() => {
  vi.clearAllMocks();
});

const TEST_ORG = "test-org-fs";

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

describe("storeFile", () => {
  it("uploads to S3 with correct key and returns the key", async () => {
    mockSend.mockResolvedValueOnce({} as never);

    const buffer = Buffer.from("file content");
    const key = await storeFile(TEST_ORG, "exp-001", buffer, "receipt.pdf");

    expect(key).toBe(`${TEST_ORG}/expenses/exp-001.pdf`);
    expect(mockSend).toHaveBeenCalledOnce();

    const command = mockSend.mock.calls[0][0];
    expect(command.constructor.name).toBe("PutObjectCommand");
    expect(command.input).toEqual({
      Bucket: "test-bucket",
      Key: `${TEST_ORG}/expenses/exp-001.pdf`,
      Body: buffer,
    });
  });
});

describe("getFile", () => {
  it("downloads from S3 and returns a buffer", async () => {
    const content = Buffer.from("downloaded content");
    const mockStream = (async function* () {
      yield content;
    })();

    mockSend.mockResolvedValueOnce({ Body: mockStream } as never);

    const result = await getFile(`${TEST_ORG}/expenses/exp-001.pdf`);

    expect(Buffer.isBuffer(result)).toBe(true);
    expect(result.toString()).toBe("downloaded content");
    expect(mockSend).toHaveBeenCalledOnce();
  });

  it("throws when response body is empty", async () => {
    mockSend.mockResolvedValueOnce({ Body: undefined } as never);

    await expect(
      getFile(`${TEST_ORG}/expenses/exp-001.pdf`),
    ).rejects.toThrow("Empty response body");
  });
});

describe("getPresignedUrl", () => {
  it("returns a presigned URL", async () => {
    const url = await getPresignedUrl(`${TEST_ORG}/expenses/exp-001.pdf`);
    expect(url).toBe("https://s3.example.com/signed-url");
    expect(getSignedUrl).toHaveBeenCalledOnce();
  });
});

describe("storeTempFile", () => {
  it("stores a file with tmp/ prefix and returns the key", async () => {
    mockSend.mockResolvedValueOnce({} as never);

    const buffer = Buffer.from("test content");
    const tempId = generateTempId();
    const key = await storeTempFile(TEST_ORG, tempId, buffer, "receipt.pdf");

    expect(key).toBe(`${TEST_ORG}/expenses/tmp/${tempId}.pdf`);
    expect(mockSend).toHaveBeenCalledOnce();

    const command = mockSend.mock.calls[0][0];
    expect(command.constructor.name).toBe("PutObjectCommand");
  });

  it("extracts file extension correctly", async () => {
    mockSend.mockResolvedValueOnce({} as never);

    const buffer = Buffer.from("img");
    const tempId = generateTempId();
    const key = await storeTempFile(TEST_ORG, tempId, buffer, "photo.jpg");
    expect(key).toContain(".jpg");
  });
});

describe("moveTempToExpense", () => {
  it("copies to final key, deletes temp, returns final key", async () => {
    mockSend.mockResolvedValueOnce({} as never); // CopyObjectCommand
    mockSend.mockResolvedValueOnce({} as never); // DeleteObjectCommand

    const tempPath = `${TEST_ORG}/expenses/tmp/tmp_abc.pdf`;
    const finalKey = await moveTempToExpense(tempPath, TEST_ORG, "expense-001");

    expect(finalKey).toBe(`${TEST_ORG}/expenses/expense-001.pdf`);
    expect(mockSend).toHaveBeenCalledTimes(2);

    const copyCmd = mockSend.mock.calls[0][0];
    expect(copyCmd.constructor.name).toBe("CopyObjectCommand");
    expect(copyCmd.input).toEqual({
      Bucket: "test-bucket",
      CopySource: `test-bucket/${tempPath}`,
      Key: `${TEST_ORG}/expenses/expense-001.pdf`,
    });

    const deleteCmd = mockSend.mock.calls[1][0];
    expect(deleteCmd.constructor.name).toBe("DeleteObjectCommand");
    expect(deleteCmd.input).toEqual({
      Bucket: "test-bucket",
      Key: tempPath,
    });
  });
});

describe("deleteTempFile", () => {
  it("deletes the object from S3", async () => {
    mockSend.mockResolvedValueOnce({} as never);

    await deleteTempFile(`${TEST_ORG}/expenses/tmp/tmp_abc.pdf`);

    expect(mockSend).toHaveBeenCalledOnce();
    const command = mockSend.mock.calls[0][0];
    expect(command.constructor.name).toBe("DeleteObjectCommand");
  });

  it("does not throw when delete fails", async () => {
    mockSend.mockRejectedValueOnce(new Error("NoSuchKey"));

    await expect(
      deleteTempFile(`${TEST_ORG}/expenses/tmp/nonexistent.pdf`),
    ).resolves.not.toThrow();
  });
});
