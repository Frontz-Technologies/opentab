import { formatDataStreamPart, type UIMessage } from "ai";
import { describe, expect, it, vi } from "vitest";
import { submitAiChatMessage } from "../lib/ai/chat-client";

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
    expect(fetchMock.mock.calls[0]?.[0]).toBe("/api/ai/chat");
    expect(fetchMock.mock.calls[0]?.[1]?.method).toBe("POST");
    expect(fetchMock.mock.calls[0]?.[1]?.body).toBe(
      JSON.stringify({
        messages: [{ role: "user", content: "How is revenue doing?" }],
      }),
    );

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
});
