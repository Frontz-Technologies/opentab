import { describe, it, expect, vi, beforeEach } from "vitest";

const { s3UploadMock, spawnMock } = vi.hoisted(() => ({
  s3UploadMock: vi.fn().mockResolvedValue({}),
  spawnMock: vi.fn(() => ({
    stdout: {
      pipe: vi.fn(),
      on: (event: string, cb: (chunk: Buffer) => void) => {
        if (event === "data") cb(Buffer.from("encrypted-bytes"));
      },
    },
    stdin: {},
    stderr: { on: vi.fn() },
    on: (event: string, cb: (arg: number) => void) => {
      if (event === "close") cb(0);
    },
  })),
}));

vi.mock("node:child_process", () => ({
  spawn: spawnMock,
}));
vi.mock("@aws-sdk/client-s3", () => ({
  S3Client: vi.fn(() => ({ send: s3UploadMock })),
  PutObjectCommand: vi.fn((input) => ({ input })),
}));

import { processBackup } from "../../lib/jobs/processors/backup";

describe("backup job (#224)", () => {
  beforeEach(() => {
    s3UploadMock.mockClear();
    process.env.DATABASE_URL = "postgres://u:p@h:5432/d";
    process.env.BACKUP_S3_BUCKET = "opentab-backups";
    process.env.BACKUP_S3_REGION = "hel1";
    process.env.BACKUP_S3_ENDPOINT = "https://hel1.your-objectstorage.com";
    process.env.BACKUP_S3_ACCESS_KEY = "k";
    process.env.BACKUP_S3_SECRET_KEY = "s";
    process.env.BACKUP_AGE_PUBLIC_KEY = "age1xyz";
  });

  it("uploads a daily backup with date-stamped key", async () => {
    await processBackup({ data: {} } as never);
    expect(s3UploadMock).toHaveBeenCalledOnce();
    const cmd = s3UploadMock.mock.calls[0][0];
    expect(cmd.input.Bucket).toBe("opentab-backups");
    expect(cmd.input.Key).toMatch(/^db\/\d{4}-\d{2}-\d{2}\.dump\.age$/);
  });

  it("throws when BACKUP_AGE_PUBLIC_KEY is missing", async () => {
    delete process.env.BACKUP_AGE_PUBLIC_KEY;
    await expect(processBackup({ data: {} } as never)).rejects.toThrow(
      /AGE_PUBLIC_KEY/,
    );
  });
});
