"use client";

import type { PendingConfirmation } from "@/lib/ai/types";
import { useAiChatStore } from "@/hooks/use-ai-chat-store";

type AiConfirmationProps = {
  confirmation: PendingConfirmation;
};

export function AiConfirmation({ confirmation }: AiConfirmationProps) {
  const isStreaming = useAiChatStore((state) => state.isStreaming);
  const confirmToolCall = useAiChatStore((state) => state.confirmToolCall);

  return (
    <div className="rounded-2xl border border-amber-400/30 bg-amber-400/10 px-4 py-3">
      <p className="text-xs font-medium uppercase tracking-[0.18em] text-amber-200/80">
        Confirmation required
      </p>
      <p className="mt-2 text-sm font-medium text-on-surface">
        {confirmation.summary.title}
      </p>
      <ul className="mt-3 space-y-1 text-sm text-on-surface/70">
        {confirmation.summary.details.map((detail) => (
          <li key={detail}>{detail}</li>
        ))}
      </ul>
      <div className="mt-4 flex gap-3">
        <button
          type="button"
          disabled={isStreaming}
          onClick={() =>
            confirmToolCall({
              approved: true,
              toolName: confirmation.toolName,
              args: confirmation.args,
            })
          }
          className="rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Approve
        </button>
      </div>
    </div>
  );
}
