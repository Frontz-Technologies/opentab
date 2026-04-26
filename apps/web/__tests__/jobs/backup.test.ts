import { describe, it, expect, vi, beforeEach } from "vitest";
import { EventEmitter } from "node:events";

type SpawnHandlers = {
  closeCode?: number | null;
  emitError?: Error;
  // For the age validator (first spawn call) — same shape as a real run
  validatorCloseCode?: number | null;
  validatorEmitError?: Error;
  // pg_dump (second spawn call)
  dumpCloseCode?: number | null;
  dumpEmitError?: Error;
  // age (third spawn call)
  ageCloseCode?: number | null;
  ageEmitError?: Error;
};

const { uploadDoneMock, spawnMock, S3ClientMock, UploadMock, handlers } =
  vi.hoisted(() => {
    const handlers: SpawnHandlers = {};

    const makeProc = (kind: "validator" | "dump" | "age") => {
      const proc = new EventEmitter() as EventEmitter & {
        stdout: EventEmitter & {
          pipe: (dst: unknown) => void;
          on: EventEmitter["on"];
        };
        stderr: EventEmitter;
        stdin: EventEmitter & { end: () => void };
      };
      const stdout = new EventEmitter() as EventEmitter & {
        pipe: (dst: unknown) => void;
      };
      (stdout as unknown as { pipe: (dst: unknown) => void }).pipe = vi.fn();
      const stderr = new EventEmitter();
      const stdin = new EventEmitter() as EventEmitter & { end: () => void };
      stdin.end = vi.fn();
      proc.stdout = stdout as typeof proc.stdout;
      proc.stderr = stderr;
      proc.stdin = stdin;

      // Decide outcome based on kind + handlers
      let emitError: Error | undefined;
      let closeCode: number | null | undefined;
      if (kind === "validator") {
        emitError = handlers.validatorEmitError;
        closeCode =
          handlers.validatorCloseCode === undefined
            ? 0
            : handlers.validatorCloseCode;
      } else if (kind === "dump") {
        emitError = handlers.dumpEmitError;
        closeCode =
          handlers.dumpCloseCode === undefined ? 0 : handlers.dumpCloseCode;
      } else {
        emitError = handlers.ageEmitError;
        closeCode =
          handlers.ageCloseCode === undefined ? 0 : handlers.ageCloseCode;
      }

      // Schedule async emission so listeners attach first.
      setImmediate(() => {
        if (emitError) {
          proc.emit("error", emitError);
          return;
        }
        proc.emit("close", closeCode);
      });

      return proc;
    };

    let callCount = 0;
    const spawnMock = vi.fn(() => {
      const kind =
        callCount === 0 ? "validator" : callCount === 1 ? "dump" : "age";
      callCount += 1;
      return makeProc(kind);
    });
    // Reset call counter when handlers are reset between tests.
    (spawnMock as unknown as { __reset: () => void }).__reset = () => {
      callCount = 0;
    };

    const uploadDoneMock = vi.fn().mockResolvedValue({});
    const UploadMock = vi.fn(function (this: unknown, params: unknown) {
      (this as { params: unknown }).params = params;
      (this as { done: typeof uploadDoneMock }).done = uploadDoneMock;
    }) as unknown as new (...args: unknown[]) => unknown;

    const S3ClientMock = vi.fn(() => ({}));

    return { uploadDoneMock, spawnMock, S3ClientMock, UploadMock, handlers };
  });

vi.mock("node:child_process", () => ({
  spawn: spawnMock,
}));
vi.mock("@aws-sdk/client-s3", () => ({
  S3Client: S3ClientMock,
}));
vi.mock("@aws-sdk/lib-storage", () => ({
  Upload: UploadMock,
}));

import { processBackup } from "../../lib/jobs/processors/backup";

describe("nightly backup job", () => {
  beforeEach(() => {
    uploadDoneMock.mockClear();
    spawnMock.mockClear();
    (spawnMock as unknown as { __reset: () => void }).__reset();
    for (const k of Object.keys(handlers))
      delete (handlers as Record<string, unknown>)[k];
    process.env.DATABASE_URL = "postgres://u:p@h:5432/d";
    process.env.BACKUP_S3_BUCKET = "test-bucket";
    process.env.BACKUP_S3_REGION = "test-region";
    process.env.BACKUP_S3_ENDPOINT = "https://s3.example.com";
    process.env.BACKUP_S3_ACCESS_KEY = "k";
    process.env.BACKUP_S3_SECRET_KEY = "s";
    process.env.BACKUP_AGE_PUBLIC_KEY = "age1xyz";
  });

  it("uploads a backup with timestamped key (date + time, UTC)", async () => {
    const result = await processBackup({ data: {} } as never);
    expect(uploadDoneMock).toHaveBeenCalledOnce();
    expect(UploadMock).toHaveBeenCalledOnce();
    const params = (UploadMock as unknown as { mock: { calls: unknown[][] } })
      .mock.calls[0][0] as { params: { Bucket: string; Key: string } };
    expect(params.params.Bucket).toBe("test-bucket");
    // db/YYYY-MM-DD-HH-mm-ss.dump.age
    expect(params.params.Key).toMatch(
      /^db\/\d{4}-\d{2}-\d{2}-\d{2}-\d{2}-\d{2}\.dump\.age$/,
    );
    expect(result.key).toBe(params.params.Key);
  });

  it("throws when BACKUP_AGE_PUBLIC_KEY is missing", async () => {
    delete process.env.BACKUP_AGE_PUBLIC_KEY;
    await expect(processBackup({ data: {} } as never)).rejects.toThrow(
      /AGE_PUBLIC_KEY/,
    );
    expect(spawnMock).not.toHaveBeenCalled();
  });

  it("throws when BACKUP_AGE_PUBLIC_KEY is invalid (age validator exits non-zero)", async () => {
    handlers.validatorCloseCode = 1;
    await expect(processBackup({ data: {} } as never)).rejects.toThrow(
      /invalid age recipient/,
    );
    expect(spawnMock).toHaveBeenCalledOnce();
  });

  it("throws when pg_dump exits non-zero", async () => {
    handlers.dumpCloseCode = 2;
    await expect(processBackup({ data: {} } as never)).rejects.toThrow(
      /pg_dump exited/,
    );
  });

  it("throws when the age binary cannot be spawned (ENOENT)", async () => {
    handlers.ageEmitError = Object.assign(new Error("ENOENT"), {
      code: "ENOENT",
    });
    await expect(processBackup({ data: {} } as never)).rejects.toThrow(
      /failed to spawn age/,
    );
  });
});
