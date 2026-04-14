"use client";

import type { DynamicToolUIPart } from "ai";
import { AiConfirmation } from "@/components/ai/ai-confirmation";
import { isPendingConfirmation } from "@/lib/ai/types";

type AiToolResultProps = {
  toolPart: DynamicToolUIPart;
};

function formatToolName(toolName: string) {
  return toolName
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function AiToolResult({ toolPart }: AiToolResultProps) {
  if ("output" in toolPart && isPendingConfirmation(toolPart.output)) {
    return <AiConfirmation confirmation={toolPart.output} />;
  }

  return (
    <div className="rounded-2xl border border-on-surface/10 bg-surface-container-high px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-on-surface/50">
          Tool
        </p>
        <p className="text-xs text-on-surface/50">{toolPart.state}</p>
      </div>
      <p className="mt-1 text-sm font-medium text-on-surface">
        {formatToolName(toolPart.toolName)}
      </p>
      {"output" in toolPart && toolPart.output !== undefined ? (
        <pre className="mt-3 overflow-x-auto rounded-xl bg-background/40 p-3 text-xs text-on-surface/80">
          {JSON.stringify(toolPart.output, null, 2)}
        </pre>
      ) : (
        <pre className="mt-3 overflow-x-auto rounded-xl bg-background/40 p-3 text-xs text-on-surface/80">
          {JSON.stringify(toolPart.input, null, 2)}
        </pre>
      )}
    </div>
  );
}
