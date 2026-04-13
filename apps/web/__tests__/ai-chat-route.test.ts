import { beforeEach, describe, expect, it, vi } from "vitest";

const getSessionMock = vi.fn();
const getAiSettingsSecretMock = vi.fn();
const createAiProviderMock = vi.fn();
const createToolsMock = vi.fn();
const getSystemPromptMock = vi.fn();
const streamTextMock = vi.fn();
const aiRateLimiterCheckMock = vi.fn();

vi.mock("@/lib/session", () => ({
  getSession: getSessionMock,
}));

vi.mock("@/lib/actions/ai-settings", () => ({
  getAiSettingsSecret: getAiSettingsSecretMock,
}));

vi.mock("@/lib/ai/provider", () => ({
  createAiProvider: createAiProviderMock,
}));

vi.mock("@/lib/ai/tools", () => ({
  createTools: createToolsMock,
}));

vi.mock("@/lib/ai/system-prompt", () => ({
  getSystemPrompt: getSystemPromptMock,
}));

vi.mock("@/lib/ai/rate-limiter", () => ({
  aiRateLimiter: {
    check: aiRateLimiterCheckMock,
  },
}));

vi.mock("ai", () => ({
  streamText: streamTextMock,
}));

describe("POST /api/ai/chat", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    aiRateLimiterCheckMock.mockReturnValue({ allowed: true, remaining: 19 });
    createAiProviderMock.mockReturnValue({ provider: "mock" });
    createToolsMock.mockReturnValue({});
    getSystemPromptMock.mockReturnValue("system prompt");
    streamTextMock.mockReturnValue({
      toDataStreamResponse: () => new Response("ok"),
    });
  });

  it("returns 401 when there is no session", async () => {
    getSessionMock.mockResolvedValue(null);

    const { POST } = await import("@/app/api/ai/chat/route");
    const response = await POST(
      new Request("http://localhost/api/ai/chat", {
        method: "POST",
        body: JSON.stringify({ messages: [{ role: "user", content: "hi" }] }),
      }),
    );

    expect(response.status).toBe(401);
  });

  it("returns 400 when AI is not configured", async () => {
    getSessionMock.mockResolvedValue({
      user: { id: "user-1", name: "Alex", email: "alex@example.com", locale: "en" },
      org: {
        id: "org-1",
        name: "OpenTab",
        slug: "opentab",
        countryCode: "GR",
        defaultCurrency: "EUR",
        fiscalYearStart: 1,
        taxId: null,
        taxAuthority: null,
        addressLine1: null,
        addressLine2: null,
        city: null,
        postalCode: null,
        region: null,
        phone: null,
        setupCompletedSteps: [],
      },
      role: "owner",
    });
    getAiSettingsSecretMock.mockResolvedValue(null);

    const { POST } = await import("@/app/api/ai/chat/route");
    const response = await POST(
      new Request("http://localhost/api/ai/chat", {
        method: "POST",
        body: JSON.stringify({ messages: [{ role: "user", content: "hi" }] }),
      }),
    );

    expect(response.status).toBe(400);
  });

  it("returns 429 when the org exceeds the AI rate limit", async () => {
    getSessionMock.mockResolvedValue({
      user: { id: "user-1", name: "Alex", email: "alex@example.com", locale: "en" },
      org: {
        id: "org-1",
        name: "OpenTab",
        slug: "opentab",
        countryCode: "GR",
        defaultCurrency: "EUR",
        fiscalYearStart: 1,
        taxId: null,
        taxAuthority: null,
        addressLine1: null,
        addressLine2: null,
        city: null,
        postalCode: null,
        region: null,
        phone: null,
        setupCompletedSteps: [],
      },
      role: "owner",
    });
    getAiSettingsSecretMock.mockResolvedValue({
      enabled: true,
      apiKey: "sk-test",
      model: "openai/gpt-4.1-mini",
    });
    aiRateLimiterCheckMock.mockReturnValue({ allowed: false, remaining: 0 });

    const { POST } = await import("@/app/api/ai/chat/route");
    const response = await POST(
      new Request("http://localhost/api/ai/chat", {
        method: "POST",
        body: JSON.stringify({ messages: [{ role: "user", content: "hi" }] }),
      }),
    );

    expect(response.status).toBe(429);
    expect(streamTextMock).not.toHaveBeenCalled();
  });

  it("creates tools with the current org role", async () => {
    getSessionMock.mockResolvedValue({
      user: { id: "user-1", name: "Alex", email: "alex@example.com", locale: "en" },
      org: {
        id: "org-1",
        name: "OpenTab",
        slug: "opentab",
        countryCode: "GR",
        defaultCurrency: "EUR",
        fiscalYearStart: 1,
        taxId: null,
        taxAuthority: null,
        addressLine1: null,
        addressLine2: null,
        city: null,
        postalCode: null,
        region: null,
        phone: null,
        setupCompletedSteps: [],
      },
      role: "accountant",
    });
    getAiSettingsSecretMock.mockResolvedValue({
      enabled: true,
      apiKey: "sk-test",
      model: "openai/gpt-4.1-mini",
    });

    const { POST } = await import("@/app/api/ai/chat/route");
    const response = await POST(
      new Request("http://localhost/api/ai/chat", {
        method: "POST",
        body: JSON.stringify({ messages: [{ role: "user", content: "hi" }] }),
      }),
    );

    expect(response.status).toBe(200);
    expect(createToolsMock).toHaveBeenCalledWith("org-1", {
      role: "accountant",
      confirmToolCall: undefined,
    });
  });
});
