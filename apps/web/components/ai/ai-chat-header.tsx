"use client";

import { useTranslations } from "next-intl";
import { Bot } from "lucide-react";
import { useAiChatStore } from "@/hooks/use-ai-chat-store";

export function AiChatHeader() {
  const t = useTranslations("ai");
  const isStreaming = useAiChatStore((state) => state.isStreaming);

  return (
    <div className="border-b border-on-surface/10 px-5 py-4">
      <div className="flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Bot className="h-5 w-5" />
        </div>
        <div>
          <h2 className="font-headline text-base font-semibold text-on-surface">
            {t("title")}
          </h2>
          <p className="text-xs text-on-surface/60">
            {isStreaming ? t("streaming") : t("subtitle")}
          </p>
        </div>
      </div>
    </div>
  );
}
