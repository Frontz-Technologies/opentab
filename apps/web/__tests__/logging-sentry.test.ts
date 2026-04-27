import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const captureException = vi.fn();
const setTag = vi.fn();
const setExtras = vi.fn();
const setFingerprint = vi.fn();

const scopeMethods = { setTag, setExtras, setFingerprint };

vi.mock("@sentry/nextjs", () => ({
  captureException: (err: unknown, ctx?: unknown) =>
    captureException(err, ctx),
  withScope: (cb: (scope: typeof scopeMethods) => void) => cb(scopeMethods),
}));

import { createLogger } from "@/lib/logging/logger";

describe("logger error level → Sentry", () => {
  beforeEach(() => {
    captureException.mockClear();
    setTag.mockClear();
    setExtras.mockClear();
    setFingerprint.mockClear();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("captures error-level logs with module tag", async () => {
    const log = createLogger("email-transport");
    log.error("email send failed", { to: "user@example.com" });
    await new Promise((r) => setTimeout(r, 0));

    expect(captureException).toHaveBeenCalledOnce();
    expect(setTag).toHaveBeenCalledWith("module", "email-transport");
  });

  it("fingerprints by [module, message] for dedup", async () => {
    const log = createLogger("worker");
    log.error("redis connection lost", { attempt: 3 });
    await new Promise((r) => setTimeout(r, 0));

    expect(setFingerprint).toHaveBeenCalledWith([
      "worker",
      "redis connection lost",
    ]);
  });

  it("attaches sanitized data as extras (secrets redacted)", async () => {
    const log = createLogger("auth");
    log.error("failed", {
      to: "u@x",
      password: "hunter2",
      apiKey: "sk-secret",
    });
    await new Promise((r) => setTimeout(r, 0));

    const extras = setExtras.mock.calls[0][0];
    expect(extras.password).toBe("[REDACTED]");
    expect(extras.apiKey).toBe("[REDACTED]");
    expect(extras.to).toBe("u@x");
  });

  it("constructs an Error with the log message for the stack", async () => {
    const log = createLogger("invoicing");
    log.error("PDF render timed out");
    await new Promise((r) => setTimeout(r, 0));

    const captured = captureException.mock.calls[0][0];
    expect(captured).toBeInstanceOf(Error);
    expect((captured as Error).message).toBe("PDF render timed out");
  });

  it("does not capture non-error levels", async () => {
    const log = createLogger("test");
    log.info("nothing to see");
    log.warn("watch out");
    log.debug("verbose");
    await new Promise((r) => setTimeout(r, 0));

    expect(captureException).not.toHaveBeenCalled();
  });
});
