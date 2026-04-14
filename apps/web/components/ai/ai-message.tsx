"use client";

import type { UIMessage } from "ai";
import { AiMarkdown } from "@/components/ai/ai-markdown";
import { AiToolResult } from "@/components/ai/ai-tool-result";

type AiMessageProps = {
  message: UIMessage;
};

export function AiMessage({ message }: AiMessageProps) {
  if (message.role === "user") {
    return (
      <div className="ml-auto max-w-[85%] rounded-2xl bg-surface-container-high px-4 py-3 text-sm text-on-surface">
        {message.content}
      </div>
    );
  }

  return (
    <div className="max-w-[92%] space-y-3 border-l-2 border-primary pl-4">
      {message.content ? <AiMarkdown content={message.content} /> : null}
      {message.toolInvocations?.map((toolInvocation) => (
        <AiToolResult
          key={toolInvocation.toolCallId}
          toolInvocation={toolInvocation}
        />
      ))}
    </div>
  );
}
