import type { UIMessage } from "ai";
import { describe, expect, it, vi } from "vitest";
import { confirmAiToolCall, submitAiChatMessage } from "../lib/ai/chat-client";

function createSSEStream(events: object[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const lines = events.map((e) => `data: ${JSON.stringify(e)}\n\n`).join("");

  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(lines + "data: [DONE]\n\n"));
      controller.close();
    },
  });
}

describe("submitAiChatMessage", () => {
  it("posts the new user message and appends the streamed assistant text", async () => {
    const fetchMock = vi.fn(async () => {
      return new Response(
        createSSEStream([
          { type: "start-step" },
          { type: "text-start", id: "text-1" },
          { type: "text-delta", id: "text-1", delta: "Revenue is " },
          { type: "text-delta", id: "text-1", delta: "up 12%." },
          { type: "text-end", id: "text-1" },
          { type: "finish-step" },
          { type: "finish" },
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
      parts: [{ type: "text", text: "How is revenue doing?" }],
    });

    expect(result[0]).toMatchObject({
      role: "user",
      parts: [{ type: "text", text: "How is revenue doing?" }],
    });
    expect(result[1]).toMatchObject({ role: "assistant" });
    const textParts = result[1]?.parts.filter((p) => p.type === "text");
    expect(textParts).toHaveLength(1);
    expect((textParts?.[0] as any).text).toBe("Revenue is up 12%.");
  });

  it("captures streamed tool calls and results on the assistant message", async () => {
    const fetchMock = vi.fn(async () => {
      return new Response(
        createSSEStream([
          { type: "start-step" },
          {
            type: "tool-input-available",
            toolCallId: "tool-1",
            toolName: "getRevenueSummary",
            input: { range: "this-month" },
            dynamic: true,
          },
          {
            type: "tool-output-available",
            toolCallId: "tool-1",
            output: { total: 4200 },
            dynamic: true,
          },
          { type: "finish-step" },
          { type: "finish" },
        ]),
      );
    });

    const result = await submitAiChatMessage({
      input: "Summarise this month's revenue.",
      messages: [],
      fetch: fetchMock,
    });

    const assistant = result[1];
    expect(assistant).toMatchObject({ role: "assistant" });
    const toolParts = assistant?.parts.filter(
      (p) => p.type === "dynamic-tool",
    );
    expect(toolParts).toHaveLength(1);
    expect(toolParts?.[0]).toMatchObject({
      type: "dynamic-tool",
      toolName: "getRevenueSummary",
      toolCallId: "tool-1",
      state: "output-available",
      input: { range: "this-month" },
      output: { total: 4200 },
    });
  });

  it("sends a confirmation payload when approving a pending tool action", async () => {
    const fetchMock = vi.fn(async () => {
      return new Response(
        createSSEStream([
          { type: "start-step" },
          { type: "text-start", id: "text-1" },
          { type: "text-delta", id: "text-1", delta: "Draft invoice created." },
          { type: "text-end", id: "text-1" },
          { type: "finish-step" },
          { type: "finish" },
        ]),
      );
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
  });
});
