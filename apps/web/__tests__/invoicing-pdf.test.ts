import { describe, it, expect, afterEach, vi, beforeAll } from "vitest";

// Tight timeout so the AbortSignal.timeout case completes quickly. Set
// before the module under test is imported (env is read at module load).
beforeAll(() => {
  process.env.GOTENBERG_TIMEOUT_MS = "100";
  process.env.GOTENBERG_URL = "http://gotenberg.test:3000";
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const { generatePdfFromHtml } = await import("../lib/invoicing/pdf");

const PDF_BYTES = new Uint8Array([
  0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37,
]); // "%PDF-1.7"

function okResponse() {
  return {
    ok: true,
    status: 200,
    statusText: "OK",
    arrayBuffer: async () => PDF_BYTES.buffer,
    text: async () => "",
  } as unknown as Response;
}

function errorResponse(status: number, body = "") {
  return {
    ok: false,
    status,
    statusText: `HTTP ${status}`,
    arrayBuffer: async () => new ArrayBuffer(0),
    text: async () => body,
  } as unknown as Response;
}

function networkError(code: string): Error {
  const err = new TypeError("fetch failed");
  (err as Error & { cause?: unknown }).cause = { code };
  return err;
}

describe("generatePdfFromHtml — Gotenberg wrapper resilience", () => {
  it("returns the PDF bytes on a successful first call", async () => {
    const fetchMock = vi.fn(async () => okResponse());
    vi.stubGlobal("fetch", fetchMock);

    const buf = await generatePdfFromHtml("<html></html>");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(buf.length).toBe(PDF_BYTES.length);
    expect(buf.subarray(0, 5).toString()).toBe("%PDF-");
  });

  it("retries once on a transient ECONNREFUSED and returns the PDF on the second call", async () => {
    let calls = 0;
    const fetchMock = vi.fn(async () => {
      calls++;
      if (calls === 1) throw networkError("ECONNREFUSED");
      return okResponse();
    });
    vi.stubGlobal("fetch", fetchMock);

    const buf = await generatePdfFromHtml("<html></html>");

    expect(calls).toBe(2);
    expect(buf.length).toBe(PDF_BYTES.length);
  });

  it("retries once on a transient HTTP 503 and returns the PDF on the second call", async () => {
    let calls = 0;
    const fetchMock = vi.fn(async () => {
      calls++;
      return calls === 1
        ? errorResponse(503, "service unavailable")
        : okResponse();
    });
    vi.stubGlobal("fetch", fetchMock);

    const buf = await generatePdfFromHtml("<html></html>");

    expect(calls).toBe(2);
    expect(buf.length).toBe(PDF_BYTES.length);
  });

  it("throws after 3 consecutive transient HTTP failures and reports the attempt count", async () => {
    const fetchMock = vi.fn(async () => errorResponse(502, "bad gateway"));
    vi.stubGlobal("fetch", fetchMock);

    await expect(generatePdfFromHtml("<html></html>")).rejects.toThrow(
      /3 attempts/,
    );
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("throws after 3 consecutive transient NETWORK failures with the same /3 attempts/ shape", async () => {
    // Mirror of the HTTP-502 case for the network-error path. The
    // catch branch must break out of the loop on
    // transient-exhaustion so both paths produce the synthesised
    // "after 3 attempts" message; otherwise attempt 3 falls through
    // to `throw err` and propagates the raw underlying TypeError
    // verbatim, with the post-loop throw unreachable for this class.
    const fetchMock = vi.fn(async () => {
      throw networkError("ECONNREFUSED");
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(generatePdfFromHtml("<html></html>")).rejects.toThrow(
      /3 attempts/,
    );
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("does NOT retry on a deterministic 400 — surfaces the error on the first attempt", async () => {
    const fetchMock = vi.fn(async () => errorResponse(400, "bad html"));
    vi.stubGlobal("fetch", fetchMock);

    await expect(generatePdfFromHtml("<html></html>")).rejects.toThrow(/400/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("treats a hung Gotenberg as transient: AbortSignal.timeout fires, the call is retried", async () => {
    let calls = 0;
    const fetchMock = vi.fn((_url: string, init?: RequestInit) => {
      calls++;
      const signal = init?.signal;
      // First call hangs until aborted; second call resolves successfully.
      if (calls === 1) {
        return new Promise<Response>((_resolve, reject) => {
          if (signal?.aborted) {
            reject(new DOMException("aborted", "AbortError"));
            return;
          }
          signal?.addEventListener("abort", () => {
            reject(new DOMException("aborted", "AbortError"));
          });
        });
      }
      return Promise.resolve(okResponse());
    });
    vi.stubGlobal("fetch", fetchMock);

    const buf = await generatePdfFromHtml("<html></html>");

    expect(calls).toBe(2);
    expect(buf.length).toBe(PDF_BYTES.length);
  });
});
