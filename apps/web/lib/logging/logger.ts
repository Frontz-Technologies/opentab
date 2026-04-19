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

function emit(
  level: LogLevel,
  module: string,
  message: string,
  data?: Record<string, unknown>,
) {
  if (!shouldLog(level)) return;

  const entry = {
    ts: new Date().toISOString(),
    level,
    module,
    msg: message,
    ...(data ? sanitize(data) : {}),
  };

  const output = JSON.stringify(entry);

  switch (level) {
    case "error":
      console.error(output);
      break;
    case "warn":
      console.warn(output);
      break;
    default:
      console.log(output);
  }
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
