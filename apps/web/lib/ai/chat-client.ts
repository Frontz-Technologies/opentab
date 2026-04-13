import { processDataStream, type ToolInvocation, type UIMessage } from "ai";

type SubmitAiChatMessageOptions = {
  input: string;
  messages: UIMessage[];
  fetch?: typeof fetch;
};

function createUserMessage(content: string): UIMessage {
  return {
    id: crypto.randomUUID(),
    role: "user",
    content,
    parts: [{ type: "text", text: content }],
  };
}

function appendAssistantText(message: UIMessage, text: string) {
  const lastPart = message.parts.at(-1);
  if (lastPart?.type === "text") {
    lastPart.text += text;
  } else {
    message.parts.push({ type: "text", text });
  }

  message.content += text;
}

function upsertToolInvocation(
  toolInvocations: ToolInvocation[],
  toolInvocation: ToolInvocation,
) {
  const index = toolInvocations.findIndex(
    (entry) => entry.toolCallId === toolInvocation.toolCallId,
  );

  if (index >= 0) {
    toolInvocations[index] = toolInvocation;
    return;
  }

  toolInvocations.push(toolInvocation);
}

export async function submitAiChatMessage({
  input,
  messages,
  fetch: fetchImplementation = fetch,
}: SubmitAiChatMessageOptions): Promise<UIMessage[]> {
  const trimmedInput = input.trim();
  if (!trimmedInput) {
    return messages;
  }

  const nextMessages = [...messages, createUserMessage(trimmedInput)];

  const response = await fetchImplementation("/api/ai/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      messages: nextMessages.map((message) => ({
        role: message.role,
        content: message.content,
      })),
    }),
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  if (!response.body) {
    throw new Error("AI response did not include a stream");
  }

  let assistantMessage: UIMessage | null = null;
  const toolCalls = new Map<string, { toolName: string; args: unknown }>();

  function ensureAssistantMessage(messageId?: string) {
    if (assistantMessage) {
      if (messageId && assistantMessage.id !== messageId) {
        assistantMessage.id = messageId;
      }
      return assistantMessage;
    }

    assistantMessage = {
      id: messageId ?? crypto.randomUUID(),
      role: "assistant",
      content: "",
      parts: [],
      toolInvocations: [],
    };
    nextMessages.push(assistantMessage);
    return assistantMessage;
  }

  await processDataStream({
    stream: response.body,
    onStartStepPart(part) {
      const message = ensureAssistantMessage(part.messageId);
      message.parts.push({ type: "step-start" });
    },
    onTextPart(text) {
      const message = ensureAssistantMessage();
      appendAssistantText(message, text);
    },
    onToolCallPart(toolCall) {
      const message = ensureAssistantMessage();
      const toolInvocation: ToolInvocation = {
        ...toolCall,
        state: "call",
      };

      toolCalls.set(toolCall.toolCallId, {
        toolName: toolCall.toolName,
        args: toolCall.args,
      });
      upsertToolInvocation(message.toolInvocations ?? [], toolInvocation);
      message.parts.push({
        type: "tool-invocation",
        toolInvocation,
      });
    },
    onToolResultPart(toolResult) {
      const message = ensureAssistantMessage();
      const toolCall = toolCalls.get(toolResult.toolCallId);
      if (!toolCall) {
        return;
      }

      const toolInvocation: ToolInvocation = {
        toolCallId: toolResult.toolCallId,
        toolName: toolCall.toolName,
        args: toolCall.args,
        result: toolResult.result,
        state: "result",
      };

      upsertToolInvocation(message.toolInvocations ?? [], toolInvocation);

      const existingPartIndex = message.parts.findIndex(
        (part) =>
          part.type === "tool-invocation" &&
          part.toolInvocation.toolCallId === toolResult.toolCallId,
      );

      if (existingPartIndex >= 0) {
        message.parts[existingPartIndex] = {
          type: "tool-invocation",
          toolInvocation,
        };
      } else {
        message.parts.push({
          type: "tool-invocation",
          toolInvocation,
        });
      }
    },
    onErrorPart(error) {
      throw new Error(error);
    },
  });

  return nextMessages;
}
