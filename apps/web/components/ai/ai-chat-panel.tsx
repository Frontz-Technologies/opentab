"use client";

import { useTranslations } from "next-intl";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useAiChatStore } from "@/hooks/use-ai-chat-store";
import { AiChatHeader } from "@/components/ai/ai-chat-header";
import { AiChatMessages } from "@/components/ai/ai-chat-messages";
import { AiChatInput } from "@/components/ai/ai-chat-input";

export function AiChatPanel() {
  const t = useTranslations("ai");
  const isOpen = useAiChatStore((state) => state.isOpen);
  const close = useAiChatStore((state) => state.close);

  return (
    <Sheet open={isOpen} onOpenChange={(open) => (!open ? close() : undefined)}>
      <SheetContent
        side="right"
        className="w-full border-l border-on-surface/10 bg-surface-container/90 p-0 backdrop-blur-[24px] sm:max-w-[420px]"
      >
        <SheetHeader className="sr-only">
          <SheetTitle>{t("title")}</SheetTitle>
        </SheetHeader>
        <div className="flex h-full flex-col">
          <AiChatHeader />
          <AiChatMessages />
          <AiChatInput />
        </div>
      </SheetContent>
    </Sheet>
  );
}
