"use client";

import { useTranslations } from "next-intl";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";
import { useAiChatStore } from "@/hooks/use-ai-chat-store";
import { AiChatHeader } from "@/components/ai/ai-chat-header";
import { AiChatMessages } from "@/components/ai/ai-chat-messages";
import { AiChatInput } from "@/components/ai/ai-chat-input";
import { cn } from "@/lib/utils";

export function AiChatPanel() {
  const t = useTranslations("ai");
  const isOpen = useAiChatStore((state) => state.isOpen);
  const close = useAiChatStore((state) => state.close);
  const isMobile = useIsMobile();

  return (
    <Sheet open={isOpen} onOpenChange={(open) => (!open ? close() : undefined)}>
      <SheetContent
        side={isMobile ? "bottom" : "right"}
        className={cn(
          "border-on-surface/10 bg-surface-container/90 p-0 backdrop-blur-[24px]",
          isMobile
            ? "h-[80vh] rounded-t-2xl border-t"
            : "w-full border-l sm:max-w-[420px]",
        )}
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
