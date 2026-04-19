import { beforeEach, describe, expect, it, vi } from "vitest";

const submitAiChatMessageMock = vi.fn();
const confirmAiToolCallMock = vi.fn();

vi.mock("@/lib/ai/chat-client", () => ({
  submitAiChatMessage: submitAiChatMessageMock,
  confirmAiToolCall: confirmAiToolCallMock,
}));

describe("AI chat store", () => {
  beforeEach(async () => {
    vi.resetAllMocks();
    const { useAiChatStore } = await import("@/hooks/use-ai-chat-store");
    useAiChatStore.setState({
      isOpen: false,
      messages: [],
      isStreaming: false,
      error: null,
    });
  });

  it("approves a pending tool call through the confirmation transport", async () => {
    confirmAiToolCallMock.mockResolvedValue([
      {
        id: "assistant-2",
        role: "assistant",
        content: "Created",
        parts: [{ type: "text", text: "Created" }],
      },
    ]);

    const { useAiChatStore } = await import("@/hooks/use-ai-chat-store");

    await useAiChatStore.getState().confirmToolCall({
      approved: true,
      toolName: "createDraftInvoice",
      args: { contactId: "contact-1" },
    });

    expect(confirmAiToolCallMock).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: [],
        confirmToolCall: {
          approved: true,
          toolName: "createDraftInvoice",
          args: { contactId: "contact-1" },
        },
        onProgress: expect.any(Function),
      }),
    );
    expect(useAiChatStore.getState().messages).toEqual([
      {
        id: "assistant-2",
        role: "assistant",
        content: "Created",
        parts: [{ type: "text", text: "Created" }],
      },
    ]);
  });
});
