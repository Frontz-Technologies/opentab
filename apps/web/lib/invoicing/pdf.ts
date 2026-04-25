import { createLogger } from "@/lib/logging/logger";

const MAX_ATTEMPTS = 3;
const BACKOFF_MS = [200, 400] as const;

const log = createLogger("invoice-pdf");

const RETRYABLE_STATUSES = new Set([502, 503, 504]);
const RETRYABLE_NETWORK_CODES = new Set([
  "ECONNREFUSED",
  "ECONNRESET",
  "EAI_AGAIN",
  "UND_ERR_SOCKET",
  "ENOTFOUND",
  "ETIMEDOUT",
]);

function getCauseCode(err: unknown): string | undefined {
  if (typeof err !== "object" || err === null) return undefined;
  const cause = (err as { cause?: unknown }).cause;
  if (typeof cause === "object" && cause !== null) {
    const code = (cause as { code?: unknown }).code;
    if (typeof code === "string") return code;
  }
  const directCode = (err as { code?: unknown }).code;
  if (typeof directCode === "string") return directCode;
  return undefined;
}

function isTransientError(err: unknown): boolean {
  if (err instanceof Error) {
    if (err.name === "AbortError" || err.name === "TimeoutError") return true;
    const code = getCauseCode(err);
    if (code && RETRYABLE_NETWORK_CODES.has(code)) return true;
  }
  return false;
}

function isTransientStatus(status: number): boolean {
  return RETRYABLE_STATUSES.has(status);
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

function backoffWithJitter(attempt: number): number {
  // attempt is 1-indexed; backoff between attempt 1 and 2 uses BACKOFF_MS[0].
  const base = BACKOFF_MS[attempt - 1] ?? BACKOFF_MS[BACKOFF_MS.length - 1];
  return base + Math.floor(Math.random() * 100);
}

function buildFormData(html: string): FormData {
  const formData = new FormData();
  const htmlBlob = new Blob([html], { type: "text/html" });
  formData.append("files", htmlBlob, "index.html");
  formData.append("marginTop", "0.5");
  formData.append("marginBottom", "0.5");
  formData.append("marginLeft", "0.5");
  formData.append("marginRight", "0.5");
  formData.append("paperWidth", "8.27");
  formData.append("paperHeight", "11.69");
  return formData;
}

export async function generatePdfFromHtml(html: string): Promise<Buffer> {
  const done = log.time("gotenberg-call");
  let lastError: unknown;
  let lastStatus: number | undefined;

  const gotenbergUrl = process.env.GOTENBERG_URL ?? "http://gotenberg:3000";
  // NaN/<=0 from a malformed env value would break AbortSignal.timeout
  // at fetch-call time with a TypeError instead of a clean timeout.
  // Coerce to the 30 s default so operator misconfig is non-fatal.
  const parsedTimeout = Number(process.env.GOTENBERG_TIMEOUT_MS);
  const timeoutMs =
    Number.isFinite(parsedTimeout) && parsedTimeout > 0 ? parsedTimeout : 30000;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const response = await fetch(
        `${gotenbergUrl}/forms/chromium/convert/html`,
        {
          method: "POST",
          body: buildFormData(html),
          signal: AbortSignal.timeout(timeoutMs),
        },
      );

      if (!response.ok) {
        lastStatus = response.status;
        if (isTransientStatus(response.status) && attempt < MAX_ATTEMPTS) {
          log.warn("gotenberg call retried", {
            attempt,
            status: response.status,
            reason: "transient-status",
          });
          await sleep(backoffWithJitter(attempt));
          continue;
        }
        const body = await response.text().catch(() => "");
        const message = `Gotenberg error: ${response.status} ${response.statusText} (after ${attempt} attempt${attempt === 1 ? "" : "s"})${body ? ` — ${body.slice(0, 200)}` : ""}`;
        log.error("gotenberg call failed", {
          attempts: attempt,
          status: response.status,
          bodyPreview: body.slice(0, 200),
        });
        throw new Error(message);
      }

      const arrayBuffer = await response.arrayBuffer();
      done("gotenberg call succeeded", {
        attempt,
        bytes: arrayBuffer.byteLength,
      });
      return Buffer.from(arrayBuffer);
    } catch (err) {
      lastError = err;
      if (isTransientError(err)) {
        if (attempt < MAX_ATTEMPTS) {
          const errorName = err instanceof Error ? err.name : "Unknown";
          const code = getCauseCode(err);
          log.warn("gotenberg call retried", {
            attempt,
            errorName,
            code,
            reason: "transient-error",
          });
          await sleep(backoffWithJitter(attempt));
          continue;
        }
        // Transient class but we're out of attempts. Break to let the
        // post-loop synthesised throw run — keeps the exhaustion error
        // shape symmetric with the transient-status path (both produce
        // "after N attempts" text observability hooks can match on).
        break;
      }
      // Non-transient — surface verbatim, no retry.
      throw err;
    }
  }

  // Exhausted retries on a transient class — throw a single, contextful error.
  const errorName = lastError instanceof Error ? lastError.name : "Unknown";
  const errorMessage =
    lastError instanceof Error ? lastError.message : String(lastError);
  log.error("gotenberg call failed", {
    attempts: MAX_ATTEMPTS,
    lastStatus,
    errorName,
    errorMessage,
  });
  throw new Error(
    `Gotenberg failed after ${MAX_ATTEMPTS} attempts (lastStatus=${lastStatus ?? "n/a"}, errorName=${errorName}): ${errorMessage}`,
  );
}
