"use client";

import { useTranslations } from "next-intl";
import { Bot } from "lucide-react";
import { useAiChatStore } from "@/hooks/use-ai-chat-store";

export function AiChatButton() {
  const t = useTranslations("ai");
  const open = useAiChatStore((state) => state.open);

  if (process.env.NEXT_PUBLIC_FEATURE_AI_CHAT !== "on") return null;

  return (
    <button
      type="button"
      onClick={open}
      className="fixed bottom-[calc(5rem+env(safe-area-inset-bottom))] right-[max(1.5rem,env(safe-area-inset-right))] z-50 flex size-14 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary/80 text-primary-foreground shadow-lg transition-transform hover:scale-105 md:bottom-[calc(1.5rem+env(safe-area-inset-bottom))]"
      aria-label={t("open")}
    >
      <Bot className="h-6 w-6" />
    </button>
  );
}
