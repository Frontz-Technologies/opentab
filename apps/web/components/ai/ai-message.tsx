"use client";

import type { UIMessage, DynamicToolUIPart } from "ai";
import { AiMarkdown } from "@/components/ai/ai-markdown";
import { AiToolResult } from "@/components/ai/ai-tool-result";

type AiMessageProps = {
  message: UIMessage;
};

export function AiMessage({ message }: AiMessageProps) {
  if (message.role === "user") {
    const text = message.parts
      .filter(
        (p): p is Extract<typeof p, { type: "text" }> => p.type === "text",
      )
      .map((p) => p.text)
      .join("");
    return (
      <div className="ml-auto max-w-[85%] rounded-2xl bg-surface-container-high px-4 py-3 text-sm text-on-surface">
        {text}
      </div>
    );
  }

  const textContent = message.parts
    .filter((p): p is Extract<typeof p, { type: "text" }> => p.type === "text")
    .map((p) => p.text)
    .join("");

  const toolParts = message.parts.filter(
    (p): p is DynamicToolUIPart => p.type === "dynamic-tool",
  );

  return (
    <div className="max-w-[92%] space-y-3 border-l-2 border-primary pl-4">
      {textContent ? <AiMarkdown content={textContent} /> : null}
      {toolParts.map((part) => (
        <AiToolResult key={part.toolCallId} toolPart={part} />
      ))}
    </div>
  );
}
