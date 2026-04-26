import { describe, it, expect, vi, beforeEach } from "vitest";

const generateObjectMock = vi.fn();
const generateTextMock = vi.fn();

class FakeNoObjectGeneratedError extends Error {
  text?: string;
  constructor(message: string, text?: string) {
    super(message);
    this.name = "AI_NoObjectGeneratedError";
    this.text = text;
  }
  static isInstance(e: unknown): e is FakeNoObjectGeneratedError {
    return e instanceof FakeNoObjectGeneratedError;
  }
}

vi.mock("ai", () => ({
  generateObject: (...args: unknown[]) => generateObjectMock(...args),
  generateText: (...args: unknown[]) => generateTextMock(...args),
  NoObjectGeneratedError: FakeNoObjectGeneratedError,
}));

vi.mock("@/lib/ai/provider", () => ({
  createAiProvider: vi.fn(() => ({ provider: "mock" })),
}));

vi.mock("@/lib/actions/ai-settings", () => ({
  getModelCapabilities: vi.fn(async () => ({
    text: true,
    image: true,
    file: true,
  })),
}));

const warnSpy = vi.fn();
const infoSpy = vi.fn();
vi.mock("@/lib/logging/logger", () => ({
  createLogger: () => ({
    info: (...args: unknown[]) => infoSpy(...args),
    warn: (...args: unknown[]) => warnSpy(...args),
    error: vi.fn(),
    debug: vi.fn(),
    time: () => () => {},
  }),
}));

describe("extractReceiptData — NoObjectGeneratedError observability (#175)", () => {
  beforeEach(() => {
    process.env.FEATURE_AI_EXTRACTION = "on";
    generateObjectMock.mockReset();
    generateTextMock.mockReset();
    warnSpy.mockReset();
    infoSpy.mockReset();
  });

  it("logs the raw model response (clipped to 1 KB) on NoObjectGeneratedError", async () => {
    const rawText = "x".repeat(2048);
    generateObjectMock.mockRejectedValueOnce(
      new FakeNoObjectGeneratedError(
        "No object generated: could not parse the response",
        rawText,
      ),
    );
    generateTextMock.mockResolvedValueOnce({
      text: JSON.stringify({ vendorName: "Acme", totalAmount: 10 }),
    });

    process.env.AI_MODEL_EXTRACTION = "google/gemini-2.5-flash-lite";
    const { extractReceiptData } =
      await import("../lib/expenses/ai-extraction");
    await extractReceiptData(
      Buffer.from("fake-pdf"),
      "application/pdf",
      "apiKey",
      [{ code: "gr_other", name: "Other" }],
    );

    const warnCall = warnSpy.mock.calls.find(
      ([message]) =>
        typeof message === "string" &&
        message.startsWith("structured output failed"),
    );
    expect(warnCall).toBeDefined();
    const meta = warnCall?.[1] as Record<string, unknown>;
    expect(typeof meta.rawResponse).toBe("string");
    expect((meta.rawResponse as string).length).toBeLessThanOrEqual(1024);
    expect(meta.rawResponseClipped).toBe(true);
  });

  it("logs the generated JSON Schema at most once per category-code set per process", async () => {
    generateObjectMock.mockResolvedValue({ object: { vendorName: "A" } });

    process.env.AI_MODEL_EXTRACTION = "google/gemini-2.5-flash-lite";
    const { extractReceiptData } =
      await import("../lib/expenses/ai-extraction");
    const categories = [{ code: "gr_rent", name: "Rent" }];
    await extractReceiptData(
      Buffer.from("x"),
      "image/png",
      "apiKey",
      categories,
    );
    await extractReceiptData(
      Buffer.from("x"),
      "image/png",
      "apiKey",
      categories,
    );

    const schemaDumpCalls = infoSpy.mock.calls.filter(
      ([message]) =>
        typeof message === "string" && message === "extraction JSON schema",
    );
    expect(schemaDumpCalls).toHaveLength(1);
    const meta = schemaDumpCalls[0]?.[1] as Record<string, unknown>;
    expect(meta.jsonSchema).toBeDefined();
    expect(meta.categoryCount).toBe(1);
  });
});
