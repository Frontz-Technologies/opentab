import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const { generateObjectMock, isFeatureEnabledMock, getFeatureModelMock } =
  vi.hoisted(() => ({
    generateObjectMock: vi.fn(),
    isFeatureEnabledMock: vi.fn(),
    getFeatureModelMock: vi.fn(),
  }));

vi.mock("ai", () => ({
  generateObject: generateObjectMock,
}));

vi.mock("@/lib/ai/features", () => ({
  isFeatureEnabled: isFeatureEnabledMock,
  getFeatureModel: getFeatureModelMock,
}));

vi.mock("@/lib/ai/provider", () => ({
  createAiProvider: vi.fn(() => ({ id: "mock-language-model" })),
}));

import { getAiColumnMatches } from "@/lib/import/core/ai-match";

const INVOICES_FIELDS = [
  { name: "invoiceNumber", required: true },
  { name: "contactName", required: true },
  { name: "totalAmount", required: true },
  { name: "issueDate", required: false },
];

const FIXED_INPUT = {
  apiKey: "sk-test",
  entityKey: "invoices",
  fields: INVOICES_FIELDS,
  headers: ["#"],
  rows: [{ "#": "INV-1" }],
  unmappedHeaders: ["#"],
};

beforeEach(() => {
  generateObjectMock.mockReset();
  isFeatureEnabledMock.mockReturnValue(true);
  getFeatureModelMock.mockReturnValue("openai/gpt-4o");
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("getAiColumnMatches", () => {
  it("returns [] when feature is disabled", async () => {
    isFeatureEnabledMock.mockReturnValue(false);
    const out = await getAiColumnMatches(FIXED_INPUT);
    expect(out).toEqual([]);
    expect(generateObjectMock).not.toHaveBeenCalled();
  });

  it("returns [] when there are no unmapped headers", async () => {
    const out = await getAiColumnMatches({
      ...FIXED_INPUT,
      headers: ["invoiceNumber"],
      rows: [{ invoiceNumber: "INV-1" }],
      unmappedHeaders: [],
    });
    expect(out).toEqual([]);
    expect(generateObjectMock).not.toHaveBeenCalled();
  });

  it("calls generateObject with headers + 3 sample values per unmapped column", async () => {
    generateObjectMock.mockResolvedValue({ object: { matches: [] } });
    await getAiColumnMatches({
      ...FIXED_INPUT,
      headers: ["#", "Customer", "Amount"],
      rows: [
        { "#": "INV-1", Customer: "A Corp", Amount: "1000" },
        { "#": "INV-2", Customer: "B Corp", Amount: "2000" },
        { "#": "INV-3", Customer: "C Corp", Amount: "3000" },
        { "#": "INV-4", Customer: "D Corp", Amount: "4000" },
      ],
      unmappedHeaders: ["#", "Customer", "Amount"],
    });
    expect(generateObjectMock).toHaveBeenCalledOnce();
    const arg = generateObjectMock.mock.calls[0][0];
    const prompt = JSON.parse(arg.prompt) as {
      theirColumns: { header: string; samples: string[] }[];
    };
    expect(prompt.theirColumns).toHaveLength(3);
    expect(prompt.theirColumns[0]).toEqual({
      header: "#",
      samples: ["INV-1", "INV-2", "INV-3"],
    });
  });

  it("truncates sample values to 32 chars", async () => {
    const long = "x".repeat(60);
    generateObjectMock.mockResolvedValue({ object: { matches: [] } });
    await getAiColumnMatches({
      ...FIXED_INPUT,
      headers: ["Note"],
      rows: [{ Note: long }],
      unmappedHeaders: ["Note"],
    });
    const arg = generateObjectMock.mock.calls[0][0];
    const prompt = JSON.parse(arg.prompt) as {
      theirColumns: { header: string; samples: string[] }[];
    };
    expect(prompt.theirColumns[0].samples[0]).toHaveLength(32);
  });

  it("filters samples to non-empty values", async () => {
    generateObjectMock.mockResolvedValue({ object: { matches: [] } });
    await getAiColumnMatches({
      ...FIXED_INPUT,
      headers: ["Number"],
      rows: [{ Number: "" }, { Number: "" }, { Number: "INV-3" }],
      unmappedHeaders: ["Number"],
    });
    const arg = generateObjectMock.mock.calls[0][0];
    const prompt = JSON.parse(arg.prompt) as {
      theirColumns: { header: string; samples: string[] }[];
    };
    expect(prompt.theirColumns[0].samples).toEqual(["INV-3"]);
  });

  it("filters out hallucinated ourField values", async () => {
    generateObjectMock.mockResolvedValue({
      object: {
        matches: [
          { ourField: "fakeField", theirHeader: "#", confidence: 0.9 },
          { ourField: "invoiceNumber", theirHeader: "#", confidence: 0.9 },
        ],
      },
    });
    const out = await getAiColumnMatches(FIXED_INPUT);
    expect(out).toHaveLength(1);
    expect(out[0].ourField).toBe("invoiceNumber");
  });

  it("filters out matches with theirHeader not in unmappedHeaders", async () => {
    generateObjectMock.mockResolvedValue({
      object: {
        matches: [
          {
            ourField: "invoiceNumber",
            theirHeader: "Stranger",
            confidence: 0.9,
          },
        ],
      },
    });
    const out = await getAiColumnMatches(FIXED_INPUT);
    expect(out).toEqual([]);
  });

  it("drops matches with confidence < 0.50", async () => {
    generateObjectMock.mockResolvedValue({
      object: {
        matches: [
          { ourField: "invoiceNumber", theirHeader: "#", confidence: 0.3 },
        ],
      },
    });
    const out = await getAiColumnMatches(FIXED_INPUT);
    expect(out).toEqual([]);
  });

  it("marks autoApply: true when confidence >= 0.85", async () => {
    generateObjectMock.mockResolvedValue({
      object: {
        matches: [
          { ourField: "invoiceNumber", theirHeader: "#", confidence: 0.92 },
        ],
      },
    });
    const out = await getAiColumnMatches(FIXED_INPUT);
    expect(out[0].autoApply).toBe(true);
  });

  it("marks autoApply: false when 0.50 <= confidence < 0.85", async () => {
    generateObjectMock.mockResolvedValue({
      object: {
        matches: [
          { ourField: "invoiceNumber", theirHeader: "#", confidence: 0.65 },
        ],
      },
    });
    const out = await getAiColumnMatches(FIXED_INPUT);
    expect(out[0].autoApply).toBe(false);
  });

  it("returns [] on LLM error and does not throw", async () => {
    generateObjectMock.mockRejectedValue(new Error("network down"));
    const out = await getAiColumnMatches(FIXED_INPUT);
    expect(out).toEqual([]);
  });
});
