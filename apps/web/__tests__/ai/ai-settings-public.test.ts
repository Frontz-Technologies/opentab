import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const { getRowMock } = vi.hoisted(() => ({
  getRowMock: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: () => getRowMock(),
        }),
      }),
    }),
  },
}));

vi.mock("@/lib/ai/encryption", () => ({
  encryptApiKey: () => ({ encrypted: "x", iv: "y" }),
  decryptApiKey: () => "decrypted",
}));

import { getAiSettings } from "@/lib/actions/ai-settings";

const ENVS = [
  "OPENROUTER_API_KEY",
  "AI_MODEL_CHAT",
  "AI_MODEL_EXTRACTION",
] as const;

describe("getAiSettings — override flags from env", () => {
  beforeEach(() => {
    for (const k of ENVS) delete process.env[k];
    getRowMock.mockReset();
    getRowMock.mockResolvedValue([
      {
        enabled: true,
        chatModel: "anthropic/claude-3-haiku",
        extractionModel: "openai/gpt-4o",
        apiKeyEncrypted: "x",
        apiKeyIv: "y",
        apiKeyLast4: "1234",
        receiptExtractionEnabled: true,
      },
    ]);
  });

  afterEach(() => {
    for (const k of ENVS) delete process.env[k];
  });

  it("all override flags false when no env is set", async () => {
    const result = await getAiSettings("org-1");
    expect(result?.apiKeyOverriddenByEnv).toBe(false);
    expect(result?.chatModelOverriddenByEnv).toBe(false);
    expect(result?.extractionModelOverriddenByEnv).toBe(false);
  });

  it("apiKeyOverriddenByEnv true when OPENROUTER_API_KEY is set", async () => {
    process.env.OPENROUTER_API_KEY = "env-key";
    const result = await getAiSettings("org-1");
    expect(result?.apiKeyOverriddenByEnv).toBe(true);
  });

  it("chatModelOverriddenByEnv true when AI_MODEL_CHAT is set", async () => {
    process.env.AI_MODEL_CHAT = "openai/gpt-4o-mini";
    const result = await getAiSettings("org-1");
    expect(result?.chatModelOverriddenByEnv).toBe(true);
    expect(result?.extractionModelOverriddenByEnv).toBe(false);
  });

  it("extractionModelOverriddenByEnv true when AI_MODEL_EXTRACTION is set", async () => {
    process.env.AI_MODEL_EXTRACTION = "openai/gpt-4o";
    const result = await getAiSettings("org-1");
    expect(result?.extractionModelOverriddenByEnv).toBe(true);
    expect(result?.chatModelOverriddenByEnv).toBe(false);
  });

  it("returned shape includes chatModel + extractionModel + override flags", async () => {
    const result = await getAiSettings("org-1");
    expect(result).toMatchObject({
      enabled: true,
      chatModel: "anthropic/claude-3-haiku",
      extractionModel: "openai/gpt-4o",
      apiKeyLast4: "1234",
      hasApiKey: true,
      receiptExtractionEnabled: true,
      apiKeyOverriddenByEnv: false,
      chatModelOverriddenByEnv: false,
      extractionModelOverriddenByEnv: false,
    });
  });
});
