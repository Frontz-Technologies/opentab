"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Hourglass, Send } from "lucide-react";
import { useAiChatStore } from "@/hooks/use-ai-chat-store";

export function AiChatInput() {
  const t = useTranslations("ai");
  const [value, setValue] = useState("");
  const submitMessage = useAiChatStore((state) => state.submitMessage);
  const isStreaming = useAiChatStore((state) => state.isStreaming);
  const clearError = useAiChatStore((state) => state.clearError);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed) return;

    const submitted = await submitMessage(trimmed);
    if (submitted) {
      setValue("");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="border-t border-on-surface/10 p-4">
      <div className="flex items-end gap-3 rounded-2xl bg-surface-container-high p-3">
        <textarea
          value={value}
          onChange={(e) => {
            clearError();
            setValue(e.target.value);
          }}
          rows={3}
          placeholder={t("inputPlaceholder")}
          disabled={isStreaming}
          className="min-h-[72px] flex-1 resize-none bg-transparent text-sm text-on-surface outline-none placeholder:text-on-surface/40"
        />
        <button
          type="submit"
          disabled={isStreaming}
          className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground transition-colors hover:bg-primary/90"
          aria-label={t("send")}
        >
          {isStreaming ? (
            <Hourglass className="h-[18px] w-[18px]" />
          ) : (
            <Send className="h-[18px] w-[18px]" />
          )}
        </button>
      </div>
    </form>
  );
}
