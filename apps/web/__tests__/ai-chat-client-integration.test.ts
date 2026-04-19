import { type UIMessage, type UIMessageChunk } from "ai";
import { describe, expect, it, vi } from "vitest";
import { submitAiChatMessage } from "../lib/ai/chat-client";

// No mock for "ai" — this suite exercises the REAL readUIMessageStream
// against a replay of the server's SSE wire format. The unit test in
// ai-chat-client.test.ts mocks readUIMessageStream, which is why the
// integration bug (#154) slipped through: the mock hid the fact that
// the raw response.body bytes never reached the stream consumer.

function createSseResponse(chunks: UIMessageChunk[]): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`),
        );
      }
      controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      controller.close();
    },
  });
  return new Response(stream, {
    status: 200,
    headers: {
      "content-type": "text/event-stream",
      "x-vercel-ai-ui-message-stream": "v1",
    },
  });
}

describe("submitAiChatMessage (SSE integration)", () => {
  it("parses the server's SSE UI message stream and emits assistant deltas (#154)", async () => {
    // Replay the exact event sequence a real `toUIMessageStreamResponse()`
    // produces for a single short assistant reply.
    const wireChunks: UIMessageChunk[] = [
      { type: "start", messageId: "assistant-1" },
      { type: "start-step" },
      { type: "text-start", id: "t1" },
      { type: "text-delta", id: "t1", delta: "Hi" },
      { type: "text-delta", id: "t1", delta: " there" },
      { type: "text-delta", id: "t1", delta: "!" },
      { type: "text-end", id: "t1" },
      { type: "finish-step" },
      { type: "finish", finishReason: "stop" },
    ];

    const fetchMock = vi.fn(async () => createSseResponse(wireChunks));
    const progressCalls: UIMessage[][] = [];

    const result = await submitAiChatMessage({
      input: "Say hi",
      messages: [],
      fetch: fetchMock,
      onProgress: (msgs) => progressCalls.push(msgs.map((m) => ({ ...m }))),
    });

    // Final messages list must contain user + assistant.
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      role: "user",
      parts: [{ type: "text", text: "Say hi" }],
    });
    expect(result[1].role).toBe("assistant");
    const assistantText = (result[1].parts ?? []).find(
      (p): p is { type: "text"; text: string } => p.type === "text",
    );
    expect(assistantText?.text).toBe("Hi there!");

    // Progressive rendering: at least three snapshots (user, partial
    // assistant, complete assistant). The Zustand store subscribes to this
    // callback — if the final list contains no assistant entry, issue #154
    // reproduces.
    expect(progressCalls.length).toBeGreaterThanOrEqual(3);

    const lastProgress = progressCalls[progressCalls.length - 1];
    expect(lastProgress[lastProgress.length - 1].role).toBe("assistant");
    const lastAssistantText = (
      lastProgress[lastProgress.length - 1].parts ?? []
    ).find((p): p is { type: "text"; text: string } => p.type === "text");
    expect(lastAssistantText?.text).toBe("Hi there!");
  });
});
