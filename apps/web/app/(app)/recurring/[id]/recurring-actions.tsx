"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Pause, Play, Trash2 } from "lucide-react";
import type { RecurringInvoice } from "@opentab/db/schema";
import { RECURRING_STATUS } from "@opentab/db/schema";
import { Button } from "@/components/ui/button";
import { pauseRecurring, resumeRecurring, deleteRecurring } from "../actions";

interface RecurringActionsProps {
  recurring: RecurringInvoice;
}

export function RecurringActions({ recurring }: RecurringActionsProps) {
  const t = useTranslations("recurring");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleAction(
    action: (id: string) => Promise<{ success: boolean }>,
    confirmMessage: string,
    redirectTo?: string,
  ) {
    if (!confirm(confirmMessage)) return;
    startTransition(async () => {
      const result = await action(recurring.id);
      if (result.success && redirectTo) {
        router.push(redirectTo);
      }
    });
  }

  return (
    <div className="flex gap-2">
      {recurring.status === RECURRING_STATUS.ACTIVE && (
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            handleAction(pauseRecurring, "Pause this recurring invoice?")
          }
          disabled={isPending}
        >
          <Pause className="h-4 w-4 mr-1" />
          {t("pause")}
        </Button>
      )}
      {recurring.status === RECURRING_STATUS.PAUSED && (
        <Button
          size="sm"
          onClick={() =>
            handleAction(resumeRecurring, "Resume this recurring invoice?")
          }
          disabled={isPending}
        >
          <Play className="h-4 w-4 mr-1" />
          {t("resume")}
        </Button>
      )}
      <Button
        variant="outline"
        size="sm"
        onClick={() =>
          handleAction(deleteRecurring, t("deleteConfirm"), "/recurring")
        }
        disabled={isPending}
      >
        <Trash2 className="h-4 w-4 mr-1" />
        {t("delete")}
      </Button>
    </div>
  );
}
