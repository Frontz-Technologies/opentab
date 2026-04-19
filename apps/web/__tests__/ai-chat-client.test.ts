import { type UIMessage } from "ai";
import { describe, expect, it, vi } from "vitest";
import { confirmAiToolCall, submitAiChatMessage } from "../lib/ai/chat-client";

// Mock readUIMessageStream to return a simple async iterable.
// The default mock yields a single completed message; individual tests
// can override via vi.mocked(readUIMessageStream).mockReturnValueOnce(...).
vi.mock("ai", async (importOriginal) => {
  const actual = await importOriginal<typeof import("ai")>();
  return {
    ...actual,
    readUIMessageStream: vi.fn(({}: { stream: ReadableStream }) =>
      (async function* () {
        yield {
          id: "assistant-1",
          role: "assistant" as const,
          parts: [{ type: "text" as const, text: "Revenue is up 12%." }],
        };
      })(),
    ),
  };
});

const { readUIMessageStream } = await import("ai");

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
      parts: [{ type: "text", text: "How is revenue doing?" }],
    });

    expect(result[0]).toMatchObject({
      role: "user",
      parts: [{ type: "text", text: "How is revenue doing?" }],
    });
    expect(result[1]).toMatchObject({
      id: "assistant-1",
      role: "assistant",
    });
  });

  it("returns messages unchanged when input is empty and no confirmToolCall", async () => {
    const existing: UIMessage[] = [
      { id: "1", role: "user", parts: [{ type: "text", text: "hi" }] },
    ];
    const result = await submitAiChatMessage({
      input: "",
      messages: existing,
    });
    expect(result).toBe(existing);
  });

  it("emits progressive onProgress updates — user bubble first, then each assistant delta (#154)", async () => {
    // Override the default mock to yield TWO progressive assistant snapshots,
    // simulating a real SSE stream where UIMessage grows over time.
    vi.mocked(readUIMessageStream).mockReturnValueOnce(
      (async function* () {
        yield {
          id: "assistant-1",
          role: "assistant" as const,
          parts: [{ type: "text" as const, text: "Revenue" }],
        };
        yield {
          id: "assistant-1",
          role: "assistant" as const,
          parts: [{ type: "text" as const, text: "Revenue is up 12%." }],
        };
      })(),
    );

    const fetchMock = vi.fn(async () => new Response(new ReadableStream()));
    const progressCalls: UIMessage[][] = [];

    await submitAiChatMessage({
      input: "How is revenue?",
      messages: [],
      fetch: fetchMock,
      onProgress: (msgs) => progressCalls.push(msgs.map((m) => ({ ...m }))),
    });

    // Expect at least three emissions: user bubble, partial assistant,
    // complete assistant. Order matters — user must come first.
    expect(progressCalls.length).toBeGreaterThanOrEqual(3);

    // First emission is user-only (before fetch resolves).
    expect(progressCalls[0]).toHaveLength(1);
    expect(progressCalls[0][0]).toMatchObject({
      role: "user",
      parts: [{ type: "text", text: "How is revenue?" }],
    });

    // Later emissions include the assistant message alongside the user.
    const last = progressCalls[progressCalls.length - 1];
    expect(last).toHaveLength(2);
    expect(last[0].role).toBe("user");
    expect(last[1]).toMatchObject({
      role: "assistant",
      parts: [{ type: "text", text: "Revenue is up 12%." }],
    });

    // Somewhere in between the assistant text should still be partial.
    const mid = progressCalls[progressCalls.length - 2];
    const midAssistant = mid.find((m) => m.role === "assistant");
    expect(midAssistant).toBeDefined();
    const midText = midAssistant?.parts?.find(
      (p: { type: string }) => p.type === "text",
    ) as { text: string } | undefined;
    expect(midText?.text).toBe("Revenue");
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
      parts: [{ type: "text", text: "Approved. Continue." }],
    });
  });
});
