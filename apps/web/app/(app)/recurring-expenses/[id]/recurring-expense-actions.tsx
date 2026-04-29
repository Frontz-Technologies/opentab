"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Trash2 } from "lucide-react";
import type { RecurringExpense } from "@opentab/db/schema";
import { RECURRING_EXPENSE_STATUS } from "@opentab/db/schema";
import { Button } from "@/components/ui/button";
import {
  pauseRecurringExpense,
  resumeRecurringExpense,
  deleteRecurringExpense,
} from "../actions";

interface RecurringExpenseActionsProps {
  recurring: RecurringExpense;
}

export function RecurringExpenseActions({
  recurring,
}: RecurringExpenseActionsProps) {
  const t = useTranslations("recurringExpenses");
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
      } else {
        router.refresh();
      }
    });
  }

  return (
    <div className="flex gap-2">
      {recurring.status === RECURRING_EXPENSE_STATUS.ACTIVE && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleAction(pauseRecurringExpense, t("pauseConfirm"))}
          disabled={isPending}
        >
          {t("pause")}
        </Button>
      )}
      {recurring.status === RECURRING_EXPENSE_STATUS.PAUSED && (
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            handleAction(resumeRecurringExpense, t("resumeConfirm"))
          }
          disabled={isPending}
        >
          {t("resume")}
        </Button>
      )}
      <Button
        variant="outline"
        size="sm"
        onClick={() =>
          handleAction(
            deleteRecurringExpense,
            t("deleteConfirm"),
            "/recurring-expenses",
          )
        }
        disabled={isPending}
      >
        <Trash2 className="h-4 w-4 mr-1" />
        {t("delete")}
      </Button>
    </div>
  );
}
