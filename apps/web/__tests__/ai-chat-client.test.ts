import { type UIMessage } from "ai";
import { describe, expect, it, vi } from "vitest";
import { confirmAiToolCall, submitAiChatMessage } from "../lib/ai/chat-client";

// Mock readUIMessageStream to return a simple async iterable
vi.mock("ai", async (importOriginal) => {
  const actual = await importOriginal<typeof import("ai")>();
  return {
    ...actual,
    readUIMessageStream: vi.fn(({}: { stream: ReadableStream }) =>
      (async function* () {
        yield {
          id: "assistant-1",
          role: "assistant" as const,
          content: "Revenue is up 12%.",
          parts: [{ type: "text" as const, text: "Revenue is up 12%." }],
        };
      })(),
    ),
  };
});

describe("submitAiChatMessage", () => {
  it("posts the new user message and appends the streamed assistant response", async () => {
    const fetchMock = vi.fn(async () => {
      return new Response(new ReadableStream());
    });

    const result = await submitAiChatMessage({
      input: "How is revenue doing?",
      messages: [],
      fetch: fetchMock,
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect((fetchMock as any).mock.calls[0]?.[0]).toBe("/api/ai/chat");
    expect((fetchMock as any).mock.calls[0]?.[1]?.method).toBe("POST");

    const requestInit = (fetchMock as any).mock.calls[0]?.[1] as RequestInit;
    const body = JSON.parse(String(requestInit?.body)) as {
      messages: UIMessage[];
    };
    expect(body.messages).toHaveLength(1);
    expect(body.messages[0]).toMatchObject({
      role: "user",
      content: "How is revenue doing?",
    });

    expect(result[0]).toMatchObject({
      role: "user",
      content: "How is revenue doing?",
    });
    expect(result[1]).toMatchObject({
      id: "assistant-1",
      role: "assistant",
      content: "Revenue is up 12%.",
    });
  });

  it("returns messages unchanged when input is empty and no confirmToolCall", async () => {
    const existing: UIMessage[] = [
      { id: "1", role: "user", content: "hi", parts: [] },
    ];
    const result = await submitAiChatMessage({
      input: "",
      messages: existing,
    });
    expect(result).toBe(existing);
  });

  it("sends a confirmation payload when approving a pending tool action", async () => {
    const fetchMock = vi.fn(async () => {
      return new Response(new ReadableStream());
    });

    await confirmAiToolCall({
      messages: [
        {
          id: "assistant-2",
          role: "assistant",
          content: "",
          parts: [],
        },
      ],
      confirmToolCall: {
        approved: true,
        toolName: "createDraftInvoice",
        args: {
          contactId: "contact-1",
          items: [{ name: "Development", quantity: 1, unitPrice: 100 }],
        },
      },
      fetch: fetchMock,
    });

    const requestInit = (fetchMock as any).mock.calls[0]?.[1] as RequestInit;
    const body = JSON.parse(String(requestInit?.body)) as {
      messages: UIMessage[];
      confirmToolCall: {
        approved: boolean;
        toolName: string;
        args: unknown;
      };
    };

    expect(body.confirmToolCall).toEqual({
      approved: true,
      toolName: "createDraftInvoice",
      args: {
        contactId: "contact-1",
        items: [{ name: "Development", quantity: 1, unitPrice: 100 }],
      },
    });
    expect(body.messages.at(-1)).toMatchObject({
      role: "user",
      content: "Approved. Continue.",
    });
  });
});
