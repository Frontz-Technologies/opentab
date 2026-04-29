"use client";

import { useTranslations } from "next-intl";
import { MessagesSquare } from "lucide-react";
import { AiMessage } from "@/components/ai/ai-message";
import { useAiChatStore } from "@/hooks/use-ai-chat-store";

export function AiChatMessages() {
  const t = useTranslations("ai");
  const messages = useAiChatStore((state) => state.messages);
  const error = useAiChatStore((state) => state.error);
  const isStreaming = useAiChatStore((state) => state.isStreaming);

  if (messages.length === 0 && !error) {
    return (
      <div className="flex flex-1 items-center justify-center px-6 py-8 text-center">
        <div className="max-w-xs space-y-3">
          <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <MessagesSquare className="h-6 w-6" />
          </div>
          <p className="text-sm font-medium text-on-surface">
            {t("emptyTitle")}
          </p>
          <p className="text-xs text-on-surface/60">{t("emptyDescription")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-3 overflow-y-auto px-4 py-4">
      {messages.map((message) => (
        <AiMessage key={message.id} message={message} />
      ))}
      {isStreaming ? (
        <div className="max-w-[92%] border-l-2 border-primary pl-4 text-sm text-on-surface/60">
          {t("streaming")}
        </div>
      ) : null}
      {error ? (
        <div className="rounded-2xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}
    </div>
  );
}
