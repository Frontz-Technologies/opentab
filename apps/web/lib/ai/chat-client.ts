import { readUIMessageStream, type UIMessage } from "ai";
import type { ConfirmToolCall } from "@/lib/ai/types";

type FetchImplementation = typeof globalThis.fetch;

type SubmitAiChatMessageOptions = {
  messages: UIMessage[];
  input?: string;
  confirmToolCall?: ConfirmToolCall;
  fetch?: FetchImplementation;
  // Called every time the message list changes: once with just the user
  // bubble before fetch, then again for every partial assistant snapshot
  // yielded by the stream. Consumers use this to render progressively.
  onProgress?: (messages: UIMessage[]) => void;
};

function createUserMessage(text: string): UIMessage {
  return {
    id: crypto.randomUUID(),
    role: "user",
    parts: [{ type: "text", text }],
  };
}

export async function submitAiChatMessage({
  input,
  messages,
  confirmToolCall,
  fetch: fetchImplementation = fetch,
  onProgress,
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

  // Emit the user bubble immediately so the UI can render it before the
  // network round-trip finishes.
  onProgress?.([...nextMessages]);

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

  // Read the UI message stream — the async iterable yields updated messages
  const messageStream = readUIMessageStream({
    stream: response.body as ReadableStream,
  });

  let lastMessage: UIMessage | null = null;
  for await (const message of messageStream) {
    lastMessage = message;
    // Emit a progressive snapshot on every delta so React re-renders as
    // tokens arrive. revalidatePath in the /api route cannot cancel this
    // because we're inside an async iterator, not a useEffect.
    onProgress?.([...nextMessages, message]);
  }

  if (lastMessage) {
    nextMessages.push(lastMessage);
  }

  return nextMessages;
}

export async function confirmAiToolCall({
  messages,
  confirmToolCall,
  fetch,
  onProgress,
}: {
  messages: UIMessage[];
  confirmToolCall: ConfirmToolCall;
  fetch?: FetchImplementation;
  onProgress?: (messages: UIMessage[]) => void;
}) {
  return submitAiChatMessage({
    messages,
    input: "Approved. Continue.",
    confirmToolCall,
    fetch,
    onProgress,
  });
}
