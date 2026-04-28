import {
  describe,
  it,
  expect,
  vi,
  beforeAll,
  beforeEach,
  afterEach,
} from "vitest";

const {
  captureException,
  setTag,
  setExtras,
  setFingerprint,
  loggerInfo,
  loggerWarn,
  loggerError,
} = vi.hoisted(() => ({
  captureException: vi.fn(),
  setTag: vi.fn(),
  setExtras: vi.fn(),
  setFingerprint: vi.fn(),
  loggerInfo: vi.fn(),
  loggerWarn: vi.fn(),
  loggerError: vi.fn(),
}));

vi.mock("@sentry/nextjs", () => ({
  captureException,
  withScope: (
    cb: (scope: {
      setTag: typeof setTag;
      setExtras: typeof setExtras;
      setFingerprint: typeof setFingerprint;
    }) => void,
  ) => cb({ setTag, setExtras, setFingerprint }),
  logger: {
    info: loggerInfo,
    warn: loggerWarn,
    error: loggerError,
  },
}));

import { createLogger } from "@/lib/logging/logger";

describe("logger error level → Sentry", () => {
  const originalForwardLevel = process.env.LOG_FORWARD_LEVEL;
  const originalDsn = process.env.SENTRY_DSN;

  // Warm the dynamic `import("@sentry/nextjs")` cache once. On cold CI
  // workers the first resolution can take more than a single setTimeout(0)
  // microtask tick, which would let captureException calls leak into the
  // following test. After this beforeAll the import is cached and resolves
  // in one microtask cycle.
  beforeAll(async () => {
    process.env.SENTRY_DSN = "https://example@glitchtip.test/1";
    process.env.LOG_FORWARD_LEVEL = "info";
    const warmup = createLogger("warmup");
    warmup.error("warmup");
    await vi.waitFor(() => {
      expect(captureException).toHaveBeenCalled();
    });
    captureException.mockClear();
    setTag.mockClear();
    setExtras.mockClear();
    setFingerprint.mockClear();
  });

  beforeEach(() => {
    process.env.LOG_FORWARD_LEVEL = "info";
    process.env.SENTRY_DSN = "https://example@glitchtip.test/1";
    captureException.mockClear();
    setTag.mockClear();
    setExtras.mockClear();
    setFingerprint.mockClear();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    process.env.LOG_FORWARD_LEVEL = originalForwardLevel;
    process.env.SENTRY_DSN = originalDsn;
    vi.restoreAllMocks();
  });

  it("captures error-level logs with module tag", async () => {
    const log = createLogger("email-transport");
    log.error("email send failed", { to: "user@example.com" });

    await vi.waitFor(() => {
      expect(captureException).toHaveBeenCalledOnce();
    });
    expect(setTag).toHaveBeenCalledWith("module", "email-transport");
  });

  it("fingerprints by [module, message] for dedup", async () => {
    const log = createLogger("worker");
    log.error("redis connection lost", { attempt: 3 });

    await vi.waitFor(() => {
      expect(setFingerprint).toHaveBeenCalledWith([
        "worker",
        "redis connection lost",
      ]);
    });
  });

  it("attaches sanitized data as extras (secrets redacted)", async () => {
    const log = createLogger("auth");
    log.error("failed", {
      to: "u@x",
      password: "hunter2",
      apiKey: "sk-secret",
    });

    await vi.waitFor(() => {
      expect(setExtras).toHaveBeenCalled();
    });
    const extras = setExtras.mock.calls[0][0];
    expect(extras.password).toBe("[REDACTED]");
    expect(extras.apiKey).toBe("[REDACTED]");
    expect(extras.to).toBe("[REDACTED]");
  });

  it("constructs an Error with the log message for the stack", async () => {
    const log = createLogger("invoicing");
    log.error("PDF render timed out");

    await vi.waitFor(() => {
      expect(captureException).toHaveBeenCalled();
    });
    const captured = captureException.mock.calls[0][0];
    expect(captured).toBeInstanceOf(Error);
    expect((captured as Error).message).toBe("PDF render timed out");
  });

  it("does not capture non-error levels", async () => {
    const log = createLogger("test");
    log.info("nothing to see");
    log.warn("watch out");
    log.debug("verbose");

    // Give any leaked microtask plenty of time to land — on a healthy
    // logger nothing should fire because info/warn/debug skip the Sentry
    // path entirely.
    await new Promise((r) => setTimeout(r, 100));
    expect(captureException).not.toHaveBeenCalled();
  });
});

describe("logger info/warn/error → Sentry.logger (Logs tab)", () => {
  const originalForwardLevel = process.env.LOG_FORWARD_LEVEL;
  const originalDsn = process.env.SENTRY_DSN;

  beforeEach(() => {
    process.env.LOG_FORWARD_LEVEL = "info";
    process.env.SENTRY_DSN = "https://example@glitchtip.test/1";
    loggerInfo.mockClear();
    loggerWarn.mockClear();
    loggerError.mockClear();
    captureException.mockClear();
    setTag.mockClear();
    setExtras.mockClear();
    setFingerprint.mockClear();
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    process.env.LOG_FORWARD_LEVEL = originalForwardLevel;
    process.env.SENTRY_DSN = originalDsn;
    vi.restoreAllMocks();
  });

  it("ships info logs to Sentry.logger.info with module attribute", async () => {
    const log = createLogger("expenses");
    log.info("receipt uploaded", { orgId: "org_1", fileName: "r.pdf" });

    await vi.waitFor(() => {
      expect(loggerInfo).toHaveBeenCalledOnce();
    });
    expect(loggerInfo).toHaveBeenCalledWith("receipt uploaded", {
      module: "expenses",
      orgId: "org_1",
      fileName: "[REDACTED]",
    });
  });

  it("ships warn logs to Sentry.logger.warn", async () => {
    const log = createLogger("worker");
    log.warn("queue depth high", { depth: 1000 });

    await vi.waitFor(() => {
      expect(loggerWarn).toHaveBeenCalledOnce();
    });
    expect(loggerWarn).toHaveBeenCalledWith("queue depth high", {
      module: "worker",
      depth: 1000,
    });
  });

  it("ships error logs to BOTH Sentry.logger.error AND captureException", async () => {
    const log = createLogger("email-transport");
    log.error("email send failed", { to: "u@x" });

    await vi.waitFor(() => {
      expect(loggerError).toHaveBeenCalledOnce();
      expect(captureException).toHaveBeenCalledOnce();
    });
    expect(loggerError).toHaveBeenCalledWith("email send failed", {
      module: "email-transport",
      to: "[REDACTED]",
    });
  });

  it("routes by level exactly — info call does not fire warn or error pipes", async () => {
    const log = createLogger("test");
    log.info("nothing alarming");

    await vi.waitFor(() => {
      expect(loggerInfo).toHaveBeenCalledOnce();
    });
    expect(loggerWarn).not.toHaveBeenCalled();
    expect(loggerError).not.toHaveBeenCalled();
    expect(captureException).not.toHaveBeenCalled();
  });

  it("sanitizes extras before shipping to Sentry.logger (secrets redacted)", async () => {
    const log = createLogger("auth");
    log.info("login attempt", {
      to: "u@x",
      password: "hunter2",
      apiKey: "sk-secret",
    });

    await vi.waitFor(() => {
      expect(loggerInfo).toHaveBeenCalledOnce();
    });
    const payload = loggerInfo.mock.calls[0][1];
    expect(payload.password).toBe("[REDACTED]");
    expect(payload.apiKey).toBe("[REDACTED]");
    expect(payload.to).toBe("[REDACTED]");
    expect(payload.module).toBe("auth");
  });

  it("sanitizes nested objects inside arrays before forwarding", async () => {
    const log = createLogger("auth");
    log.info("batch processed", {
      items: [
        { id: "safe", token: "secret-token" },
        { nested: { apiKey: "sk-secret" } },
      ],
    });

    await vi.waitFor(() => {
      expect(loggerInfo).toHaveBeenCalledOnce();
    });
    const payload = loggerInfo.mock.calls[0][1];
    expect(payload.items).toEqual([
      { id: "safe", token: "[REDACTED]" },
      { nested: { apiKey: "[REDACTED]" } },
    ]);
  });

  it("honors LOG_FORWARD_LEVEL=warn by not forwarding info", async () => {
    process.env.LOG_FORWARD_LEVEL = "warn";
    const log = createLogger("test");

    log.info("beta detail");
    log.warn("actionable warning");

    await vi.waitFor(() => {
      expect(loggerWarn).toHaveBeenCalledOnce();
    });
    expect(loggerInfo).not.toHaveBeenCalled();
    expect(loggerWarn).toHaveBeenCalledWith("actionable warning", {
      module: "test",
    });
  });

  it("honors LOG_FORWARD_LEVEL=off", async () => {
    process.env.LOG_FORWARD_LEVEL = "off";
    const log = createLogger("test");

    log.error("not forwarded to logs tab");

    await vi.waitFor(() => {
      expect(captureException).toHaveBeenCalledOnce();
    });
    expect(loggerError).not.toHaveBeenCalled();
  });

  it("does not forward to GlitchTip when SENTRY_DSN is unset", async () => {
    delete process.env.SENTRY_DSN;
    process.env.LOG_FORWARD_LEVEL = "info";
    const log = createLogger("test");

    log.info("beta detail");
    log.error("captured nowhere");

    await new Promise((r) => setTimeout(r, 50));
    expect(loggerInfo).not.toHaveBeenCalled();
    expect(loggerError).not.toHaveBeenCalled();
    expect(captureException).not.toHaveBeenCalled();
  });

  it("does not forward to GlitchTip Logs when LOG_FORWARD_LEVEL is unset", async () => {
    delete process.env.LOG_FORWARD_LEVEL;
    const log = createLogger("test");

    log.info("beta detail");

    await new Promise((r) => setTimeout(r, 50));
    expect(loggerInfo).not.toHaveBeenCalled();
  });
});
