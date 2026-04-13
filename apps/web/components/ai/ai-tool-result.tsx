"use client";

import type { ToolInvocation } from "ai";
import { AiConfirmation } from "@/components/ai/ai-confirmation";
import { isPendingConfirmation } from "@/lib/ai/types";

type AiToolResultProps = {
  toolInvocation: ToolInvocation;
};

function formatToolName(toolName: string) {
  return toolName
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function AiToolResult({ toolInvocation }: AiToolResultProps) {
  if ("result" in toolInvocation && isPendingConfirmation(toolInvocation.result)) {
    return <AiConfirmation confirmation={toolInvocation.result} />;
  }

  return (
    <div className="rounded-2xl border border-on-surface/10 bg-surface-container-high px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-on-surface/50">
          Tool
        </p>
        <p className="text-xs text-on-surface/50">{toolInvocation.state}</p>
      </div>
      <p className="mt-1 text-sm font-medium text-on-surface">
        {formatToolName(toolInvocation.toolName)}
      </p>
      {"result" in toolInvocation ? (
        <pre className="mt-3 overflow-x-auto rounded-xl bg-background/40 p-3 text-xs text-on-surface/80">
          {JSON.stringify(toolInvocation.result, null, 2)}
        </pre>
      ) : (
        <pre className="mt-3 overflow-x-auto rounded-xl bg-background/40 p-3 text-xs text-on-surface/80">
          {JSON.stringify(toolInvocation.args, null, 2)}
        </pre>
      )}
    </div>
  );
}
