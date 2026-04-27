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
  decryptApiKey: () => "decrypted-db-key",
}));

import {
  getAiSettingsSecret,
  isAiChatEnabled,
} from "@/lib/actions/ai-settings";

const ENVS = [
  "OPENROUTER_API_KEY",
  "AI_MODEL_CHAT",
  "AI_MODEL_EXTRACTION",
] as const;

describe("getAiSettingsSecret(orgId, feature)", () => {
  beforeEach(() => {
    for (const k of ENVS) delete process.env[k];
    getRowMock.mockReset();
  });

  afterEach(() => {
    for (const k of ENVS) delete process.env[k];
  });

  it("returns null when nothing is configured anywhere", async () => {
    getRowMock.mockResolvedValue([]);
    expect(await getAiSettingsSecret("org-1", "chat")).toBeNull();
    expect(await getAiSettingsSecret("org-1", "extraction")).toBeNull();
  });

  it("returns env apiKey + env model when both env vars are set (chat)", async () => {
    process.env.OPENROUTER_API_KEY = "env-key";
    process.env.AI_MODEL_CHAT = "openai/gpt-4o-mini";
    expect(await getAiSettingsSecret("org-1", "chat")).toEqual({
      apiKey: "env-key",
      model: "openai/gpt-4o-mini",
    });
    expect(getRowMock).not.toHaveBeenCalled();
  });

  it("returns env apiKey + env model for extraction independently", async () => {
    process.env.OPENROUTER_API_KEY = "env-key";
    process.env.AI_MODEL_EXTRACTION = "openai/gpt-4o";
    expect(await getAiSettingsSecret("org-1", "extraction")).toEqual({
      apiKey: "env-key",
      model: "openai/gpt-4o",
    });
  });

  it("falls through to DB per-feature model when only env apiKey is set", async () => {
    process.env.OPENROUTER_API_KEY = "env-key";
    getRowMock.mockResolvedValue([
      {
        chatModel: "anthropic/claude-3-haiku",
        extractionModel: null,
        apiKeyEncrypted: null,
        apiKeyIv: null,
      },
    ]);
    expect(await getAiSettingsSecret("org-1", "chat")).toEqual({
      apiKey: "env-key",
      model: "anthropic/claude-3-haiku",
    });
    expect(await getAiSettingsSecret("org-1", "extraction")).toBeNull();
  });

  it("returns DB apiKey + env model when only the model env is set", async () => {
    process.env.AI_MODEL_CHAT = "openai/gpt-4o-mini";
    getRowMock.mockResolvedValue([
      {
        chatModel: null,
        extractionModel: null,
        apiKeyEncrypted: "ciphertext",
        apiKeyIv: "iv",
      },
    ]);
    expect(await getAiSettingsSecret("org-1", "chat")).toEqual({
      apiKey: "decrypted-db-key",
      model: "openai/gpt-4o-mini",
    });
  });

  it("returns DB apiKey + DB per-feature model when env unset", async () => {
    getRowMock.mockResolvedValue([
      {
        chatModel: "anthropic/claude-3-haiku",
        extractionModel: "openai/gpt-4o",
        apiKeyEncrypted: "ciphertext",
        apiKeyIv: "iv",
      },
    ]);
    expect(await getAiSettingsSecret("org-1", "chat")).toEqual({
      apiKey: "decrypted-db-key",
      model: "anthropic/claude-3-haiku",
    });
    expect(await getAiSettingsSecret("org-1", "extraction")).toEqual({
      apiKey: "decrypted-db-key",
      model: "openai/gpt-4o",
    });
  });

  it("returns null when DB row exists but the per-feature model is null and env is unset", async () => {
    getRowMock.mockResolvedValue([
      {
        chatModel: null,
        extractionModel: "openai/gpt-4o",
        apiKeyEncrypted: "ciphertext",
        apiKeyIv: "iv",
      },
    ]);
    expect(await getAiSettingsSecret("org-1", "chat")).toBeNull();
    expect(await getAiSettingsSecret("org-1", "extraction")).toEqual({
      apiKey: "decrypted-db-key",
      model: "openai/gpt-4o",
    });
  });
});

describe("isAiChatEnabled — master toggle gate (mirrors isReceiptExtractionEnabled)", () => {
  beforeEach(() => {
    for (const k of ENVS) delete process.env[k];
    getRowMock.mockReset();
  });

  afterEach(() => {
    for (const k of ENVS) delete process.env[k];
  });

  it("returns true when env API key is set (deployment override wins)", async () => {
    process.env.OPENROUTER_API_KEY = "env-key";
    expect(await isAiChatEnabled("org-1")).toBe(true);
    expect(getRowMock).not.toHaveBeenCalled();
  });

  it("returns false when there's no DB row and no env key", async () => {
    getRowMock.mockResolvedValue([]);
    expect(await isAiChatEnabled("org-1")).toBe(false);
  });

  it("returns false when the master toggle is off (even with key configured)", async () => {
    getRowMock.mockResolvedValue([
      { enabled: false, apiKeyEncrypted: "ciphertext", apiKeyIv: "iv" },
    ]);
    expect(await isAiChatEnabled("org-1")).toBe(false);
  });

  it("returns false when toggle is on but no API key is stored", async () => {
    getRowMock.mockResolvedValue([
      { enabled: true, apiKeyEncrypted: null, apiKeyIv: null },
    ]);
    expect(await isAiChatEnabled("org-1")).toBe(false);
  });

  it("returns true when toggle is on AND a DB API key is present", async () => {
    getRowMock.mockResolvedValue([
      { enabled: true, apiKeyEncrypted: "ciphertext", apiKeyIv: "iv" },
    ]);
    expect(await isAiChatEnabled("org-1")).toBe(true);
  });
});
