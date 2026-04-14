import { consumeStream, readUIMessageStream, type UIMessage } from "ai";
import type { ConfirmToolCall } from "@/lib/ai/types";

type FetchImplementation = typeof globalThis.fetch;

type SubmitAiChatMessageOptions = {
  messages: UIMessage[];
  input?: string;
  confirmToolCall?: ConfirmToolCall;
  fetch?: FetchImplementation;
};

function createUserMessage(content: string): UIMessage {
  return {
    id: crypto.randomUUID(),
    role: "user",
    parts: [{ type: "text", text: content }],
  };
}

export async function submitAiChatMessage({
  input,
  messages,
  confirmToolCall,
  fetch: fetchImplementation = fetch,
}: SubmitAiChatMessageOptions): Promise<UIMessage[]> {
  const trimmedInput = input?.trim() ?? "";
  if (!trimmedInput) {
    if (!confirmToolCall) {
      return messages;
    }
  }

  const nextMessages = trimmedInput
    ? [...messages, createUserMessage(trimmedInput)]
    : [...messages];

  const response = await fetchImplementation("/api/ai/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      messages: nextMessages,
      confirmToolCall,
    }),
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  if (!response.body) {
    throw new Error("AI response did not include a stream");
  }

  const assistantMessage: UIMessage = {
    id: crypto.randomUUID(),
    role: "assistant",
    parts: [],
  };
  nextMessages.push(assistantMessage);

  await consumeStream(
    readUIMessageStream({
      message: assistantMessage,
      stream: response.body,
      onError(error) {
        throw new Error(typeof error === "string" ? error : error.message);
      },
    }),
  );

  return nextMessages;
}

export async function confirmAiToolCall({
  messages,
  confirmToolCall,
  fetch,
}: {
  messages: UIMessage[];
  confirmToolCall: ConfirmToolCall;
  fetch?: FetchImplementation;
}) {
  return submitAiChatMessage({
    messages,
    input: "Approved. Continue.",
    confirmToolCall,
    fetch,
  });
}
