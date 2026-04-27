/**
 * Structured logger for OpenTab server-side operations.
 *
 * Design principles:
 * - Structured JSON output for machine parsing (Sentry, Datadog, etc.)
 * - Log levels: debug, info, warn, error
 * - Context-scoped via createLogger("module-name")
 * - Never logs sensitive data: API keys, passwords, tokens, file contents
 * - Timing support via logger.time() for performance tracking
 * - Production-safe: debug logs suppressed when NODE_ENV=production
 *
 * Usage:
 *   const log = createLogger("expenses");
 *   log.info("receipt uploaded", { orgId, fileName, fileSize });
 *   const done = log.time("ai-extraction");
 *   // ... work ...
 *   done("extraction complete", { model, strategy });
 */

type LogLevel = "debug" | "info" | "warn" | "error";

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const MIN_LEVEL: LogLevel =
  process.env.NODE_ENV === "production" ? "info" : "debug";

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[MIN_LEVEL];
}

/** Fields that must never appear in log output. */
const REDACTED_KEYS = new Set([
  "apiKey",
  "apikey",
  "api_key",
  "password",
  "secret",
  "token",
  "authorization",
  "cookie",
  "apiKeyEncrypted",
  "apiKeyIv",
  "secretAccessKey",
  "accessKeyId",
  "subscriptionKey",
  "aadeUserId",
  "configJson",
  "responseBody",
  "requestXml",
  "responseXml",
]);

function sanitize(data: Record<string, unknown>): Record<string, unknown> {
  const clean: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (REDACTED_KEYS.has(key) || REDACTED_KEYS.has(key.toLowerCase())) {
      clean[key] = "[REDACTED]";
    } else if (value && typeof value === "object" && !Array.isArray(value)) {
      clean[key] = sanitize(value as Record<string, unknown>);
    } else {
      clean[key] = value;
    }
  }
  return clean;
}

// Module-scoped cached SDK promise. Single allocation at module load;
// every emit() awaits the same resolved value via .then().
//
// .catch(() => null) keeps the logger usable in test/dev/edge runtimes
// without the SDK installed. We do NOT gate on process.env.SENTRY_DSN —
// when DSN is unset, instrumentation.ts simply doesn't call Sentry.init,
// so Sentry.logger is either undefined or a no-op; the optional chaining
// in emit() handles that. Always-importing also keeps the existing
// vi.mock("@sentry/nextjs") test pattern from PR #239 working without
// per-test env stubs.
const sentryReady: Promise<typeof import("@sentry/nextjs") | null> =
  import("@sentry/nextjs").catch(() => null);

function emit(
  level: LogLevel,
  module: string,
  message: string,
  data?: Record<string, unknown>,
) {
  if (!shouldLog(level)) return;

  // Sanitize once and reuse for both the stdout JSON line and the Sentry
  // surfaces. If sanitize ever grows from "redact-by-keyname" into something
  // that mutates or normalises (e.g. trims long strings), the surfaces would
  // otherwise diverge.
  const safe = data ? sanitize(data) : null;

  const entry = {
    ts: new Date().toISOString(),
    level,
    module,
    msg: message,
    ...(safe ?? {}),
  };

  const output = JSON.stringify(entry);

  switch (level) {
    case "error":
      console.error(output);
      // Issues-tab pipe (PR #239). Uses the cached SDK promise instead
      // of a fresh import() per call. Behavioural shape — module-scoped
      // fingerprint, sanitised extras, dedup convention — is unchanged.
      void sentryReady
        .then((Sentry) => {
          if (!Sentry) return;
          Sentry.withScope((scope) => {
            scope.setTag("module", module);
            scope.setExtras(safe ?? {});
            scope.setFingerprint([module, message]);
            Sentry.captureException(new Error(message));
          });
        })
        .catch(() => {
          // Sentry not present (dev/test/edge runtime without SDK) — no-op.
        });
      break;
    case "warn":
      console.warn(output);
      break;
    default:
      console.log(output);
  }

  // Logs-tab pipe (issue #247). Ships info/warn/error to GlitchTip's
  // separate Logs ingestion endpoint via Sentry.logger.*. debug never
  // reaches here in prod (filtered by shouldLog above); in dev it does,
  // matching stdout. Optional chaining handles: SDK absent (Sentry === null),
  // Sentry.logger undefined (older SDK or experiment removed), or the
  // specific level fn missing.
  void sentryReady
    .then((Sentry) => {
      Sentry?.logger?.[level]?.(message, { module, ...(safe ?? {}) });
    })
    .catch(() => {
      // Sentry.logger threw (malformed extras, transport error). Silent —
      // stdout JSON line already wrote, and we don't want error-on-error
      // escalation crashing Node 22's unhandledRejection.
    });
}

export interface Logger {
  debug(message: string, data?: Record<string, unknown>): void;
  info(message: string, data?: Record<string, unknown>): void;
  warn(message: string, data?: Record<string, unknown>): void;
  error(message: string, data?: Record<string, unknown>): void;
  /** Start a timer. Returns a function to call when done. */
  time(
    operation: string,
  ): (message?: string, data?: Record<string, unknown>) => void;
}

export function createLogger(module: string): Logger {
  return {
    debug: (msg, data) => emit("debug", module, msg, data),
    info: (msg, data) => emit("info", module, msg, data),
    warn: (msg, data) => emit("warn", module, msg, data),
    error: (msg, data) => emit("error", module, msg, data),
    time(operation: string) {
      const start = performance.now();
      return (message?: string, data?: Record<string, unknown>) => {
        const durationMs = Math.round(performance.now() - start);
        emit("info", module, message ?? `${operation} completed`, {
          operation,
          durationMs,
          ...data,
        });
      };
    },
  };
}
