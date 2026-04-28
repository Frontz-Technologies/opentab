import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const TEST_ORG = "test-org-fs";

// ---------------------------------------------------------------------------
// Local filesystem mode tests (no S3_ENDPOINT)
// ---------------------------------------------------------------------------

describe("file-storage (local filesystem mode)", () => {
  beforeEach(() => {
    vi.stubEnv("S3_ENDPOINT", "");
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("generateTempId returns a string starting with tmp_", async () => {
    const { generateTempId } = await import("../lib/expenses/file-storage");
    const id = generateTempId();
    expect(id).toMatch(/^tmp_[a-f0-9-]+$/);
  });

  it("generateTempId generates unique IDs", async () => {
    const { generateTempId } = await import("../lib/expenses/file-storage");
    const ids = new Set(Array.from({ length: 10 }, () => generateTempId()));
    expect(ids.size).toBe(10);
  });

  it("getPresignedUrl returns null in local mode", async () => {
    const { getPresignedUrl } = await import("../lib/expenses/file-storage");
    const result = await getPresignedUrl("some/key");
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// S3 mode tests (S3_ENDPOINT set)
// ---------------------------------------------------------------------------

describe("file-storage (S3 mode)", () => {
  const mockSend = vi.fn();

  beforeEach(() => {
    vi.stubEnv("S3_ENDPOINT", "http://minio:9000");
    vi.resetModules();

    vi.doMock("../lib/storage/s3-client", () => ({
      s3Client: { send: mockSend },
      BUCKET: "test-bucket",
    }));

    vi.doMock("@aws-sdk/s3-request-presigner", () => ({
      getSignedUrl: vi
        .fn()
        .mockResolvedValue("https://s3.example.com/signed-url"),
    }));

    mockSend.mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("storeFile uploads to S3 with correct key", async () => {
    mockSend.mockResolvedValueOnce({});
    const { storeFile } = await import("../lib/expenses/file-storage");

    const buffer = Buffer.from("file content");
    const key = await storeFile(TEST_ORG, "exp-001", buffer, "receipt.pdf");

    expect(key).toBe(`${TEST_ORG}/expenses/exp-001.pdf`);
    expect(mockSend).toHaveBeenCalledOnce();
  });

  it("getFile downloads from S3", async () => {
    const content = Buffer.from("downloaded content");
    const mockStream = (async function* () {
      yield content;
    })();
    mockSend.mockResolvedValueOnce({ Body: mockStream });
    const { getFile } = await import("../lib/expenses/file-storage");

    const result = await getFile(`${TEST_ORG}/expenses/exp-001.pdf`);
    expect(result.toString()).toBe("downloaded content");
  });

  it("getPresignedUrl returns a URL in S3 mode", async () => {
    const { getPresignedUrl } = await import("../lib/expenses/file-storage");
    const url = await getPresignedUrl(`${TEST_ORG}/expenses/exp-001.pdf`);
    expect(url).toBe("https://s3.example.com/signed-url");
  });

  it("storeTempFile stores with tmp/ prefix", async () => {
    mockSend.mockResolvedValueOnce({});
    const { storeTempFile, generateTempId } =
      await import("../lib/expenses/file-storage");

    const tempId = generateTempId();
    const key = await storeTempFile(
      TEST_ORG,
      tempId,
      Buffer.from("test"),
      "receipt.pdf",
    );
    expect(key).toBe(`${TEST_ORG}/expenses/tmp/${tempId}.pdf`);
  });

  it("moveTempToExpense copies then deletes", async () => {
    mockSend.mockResolvedValueOnce({}); // Copy
    mockSend.mockResolvedValueOnce({}); // Delete
    const { moveTempToExpense } = await import("../lib/expenses/file-storage");

    const tempPath = `${TEST_ORG}/expenses/tmp/tmp_abc.pdf`;
    const finalKey = await moveTempToExpense(tempPath, TEST_ORG, "expense-001");

    expect(finalKey).toBe(`${TEST_ORG}/expenses/expense-001.pdf`);
    expect(mockSend).toHaveBeenCalledTimes(2);
  });

  it("deleteTempFile is idempotent on missing keys (NoSuchKey)", async () => {
    // Shape matches AWS SDK v3 thrown errors: structured `name` field
    // rather than a message-string regex. The earlier "swallow if message
    // matches /NoSuchKey/" path was dropped because it produced false
    // positives on unrelated errors whose messages happen to contain
    // "NotFound" or "NoSuchKey".
    const sdkErr = Object.assign(
      new Error("The specified key does not exist."),
      {
        name: "NoSuchKey",
        $metadata: { httpStatusCode: 404 },
      },
    );
    mockSend.mockRejectedValueOnce(sdkErr);
    const { deleteTempFile } = await import("../lib/expenses/file-storage");

    await expect(
      deleteTempFile(`${TEST_ORG}/expenses/tmp/nonexistent.pdf`),
    ).resolves.not.toThrow();
  });
});
