import { formatDataStreamPart, type UIMessage } from "ai";
import { describe, expect, it, vi } from "vitest";
import {
  confirmAiToolCall,
  submitAiChatMessage,
} from "../lib/ai/chat-client";

function createStream(parts: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();

  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const part of parts) {
        controller.enqueue(encoder.encode(part));
      }
      controller.close();
    },
  });
}

describe("submitAiChatMessage", () => {
  it("posts the new user message and appends the streamed assistant text", async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      return new Response(
        createStream([
          formatDataStreamPart("start_step", { messageId: "assistant-1" }),
          formatDataStreamPart("text", "Revenue is "),
          formatDataStreamPart("text", "up 12%."),
          formatDataStreamPart("finish_message", {
            finishReason: "stop",
            usage: { promptTokens: 10, completionTokens: 6 },
          }),
        ]),
      );
    });

    const result = await submitAiChatMessage({
      input: "How is revenue doing?",
      messages: [],
      fetch: fetchMock,
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect((fetchMock as any).mock.calls[0]?.[0]).toBe("/api/ai/chat");
    expect((fetchMock as any).mock.calls[0]?.[1]?.method).toBe("POST");
    const requestInit = (fetchMock as any).mock.calls[0]?.[1] as
      | RequestInit
      | undefined;
    const body = JSON.parse(String(requestInit?.body)) as {
      messages: UIMessage[];
    };
    expect(body.messages).toHaveLength(1);
    expect(body.messages[0]).toMatchObject({
      role: "user",
      content: "How is revenue doing?",
      parts: [{ type: "text", text: "How is revenue doing?" }],
    });

    expect(result[0]).toEqual<UIMessage>({
      id: expect.any(String),
      role: "user",
      content: "How is revenue doing?",
      parts: [{ type: "text", text: "How is revenue doing?" }],
    });
    expect(result[1]).toMatchObject({
      id: "assistant-1",
      role: "assistant",
      content: "Revenue is up 12%.",
      toolInvocations: [],
    });
    expect(result[1]?.parts).toEqual([
      { type: "step-start" },
      { type: "text", text: "Revenue is up 12%." },
    ]);
  });

  it("captures streamed tool calls and results on the assistant message", async () => {
    const fetchMock = vi.fn(async () => {
      return new Response(
        createStream([
          formatDataStreamPart("start_step", { messageId: "assistant-2" }),
          formatDataStreamPart("tool_call", {
            toolCallId: "tool-1",
            toolName: "getRevenueSummary",
            args: { range: "this-month" },
          }),
          formatDataStreamPart("tool_result", {
            toolCallId: "tool-1",
            result: { total: 4200 },
          }),
          formatDataStreamPart("finish_message", {
            finishReason: "tool-calls",
            usage: { promptTokens: 8, completionTokens: 4 },
          }),
        ]),
      );
    });

    const result = await submitAiChatMessage({
      input: "Summarise this month's revenue.",
      messages: [],
      fetch: fetchMock,
    });

    expect(result[1]).toMatchObject({
      id: "assistant-2",
      role: "assistant",
      toolInvocations: [
        {
          toolCallId: "tool-1",
          toolName: "getRevenueSummary",
          state: "result",
          args: { range: "this-month" },
          result: { total: 4200 },
        },
      ],
      parts: [
        {
          type: "step-start",
        },
        {
          type: "tool-invocation",
          toolInvocation: {
            toolCallId: "tool-1",
            toolName: "getRevenueSummary",
            state: "result",
            args: { range: "this-month" },
            result: { total: 4200 },
          },
        },
      ],
    });
  });

  it("sends a confirmation payload when approving a pending tool action", async () => {
    const fetchMock = vi.fn(async () => {
      return new Response(
        createStream([
          formatDataStreamPart("start_step", { messageId: "assistant-3" }),
          formatDataStreamPart("text", "Draft invoice created."),
          formatDataStreamPart("finish_message", {
            finishReason: "stop",
            usage: { promptTokens: 9, completionTokens: 4 },
          }),
        ]),
      );
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

    const requestInit = (fetchMock as any).mock.calls[0]?.[1] as
      | RequestInit
      | undefined;
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
