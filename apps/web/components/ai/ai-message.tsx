"use client";

import type { UIMessage } from "ai";
import { AiMarkdown } from "@/components/ai/ai-markdown";
import { AiToolResult } from "@/components/ai/ai-tool-result";

type AiMessageProps = {
  message: UIMessage;
};

export function AiMessage({ message }: AiMessageProps) {
  const textParts: string[] = [];
  const toolParts: Array<{
    toolCallId: string;
    toolName: string;
    args: unknown;
    state: string;
    result?: unknown;
  }> = [];

  for (const part of message.parts) {
    if (part.type === "text") {
      textParts.push((part as unknown as { text: string }).text);
    } else if (part.type === "tool-invocation") {
      toolParts.push(
        (part as unknown as { toolInvocation: (typeof toolParts)[number] })
          .toolInvocation,
      );
    }
  }

  const text = textParts.join("");

  if (message.role === "user") {
    return (
      <div className="ml-auto max-w-[85%] rounded-2xl bg-surface-container-high px-4 py-3 text-sm text-on-surface">
        {text}
      </div>
    );
  }

  return (
    <div className="max-w-[92%] space-y-3 border-l-2 border-primary pl-4">
      {text ? <AiMarkdown content={text} /> : null}
      {toolParts.map((inv) => (
        <AiToolResult key={inv.toolCallId} toolInvocation={inv} />
      ))}
    </div>
  );
}
