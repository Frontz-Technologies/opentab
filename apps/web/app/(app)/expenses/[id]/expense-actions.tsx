"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import type { Expense } from "@opentab/db/schema";
import { EXPENSE_STATUS } from "@opentab/db/schema";
import { Button } from "@/components/ui/button";
import { confirmExpense, cancelExpense, deleteExpense } from "../actions";

interface ExpenseActionsProps {
  expense: Expense;
}

export function ExpenseActions({ expense }: ExpenseActionsProps) {
  const t = useTranslations("expenses");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleAction(
    action: (id: string) => Promise<{ success: boolean; error?: string }>,
    confirmMessage: string,
    redirectTo?: string,
  ) {
    if (!confirm(confirmMessage)) return;
    startTransition(async () => {
      const result = await action(expense.id);
      if (result.success && redirectTo) {
        router.push(redirectTo);
      }
    });
  }

  return (
    <div className="flex gap-2">
      {expense.status === EXPENSE_STATUS.DRAFT && (
        <>
          <Button
            size="sm"
            onClick={() => handleAction(confirmExpense, t("confirmAction"))}
            disabled={isPending}
          >
            <span className="material-symbols-outlined text-[16px] mr-1">
              check_circle
            </span>
            {t("confirm")}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push(`/expenses/${expense.id}/edit`)}
            disabled={isPending}
          >
            <span className="material-symbols-outlined text-[16px] mr-1">
              edit
            </span>
            {t("editExpense")}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              handleAction(deleteExpense, t("deleteConfirm"), "/expenses")
            }
            disabled={isPending}
          >
            <span className="material-symbols-outlined text-[16px] mr-1">
              delete
            </span>
            {t("delete")}
          </Button>
        </>
      )}
      {expense.status === EXPENSE_STATUS.CONFIRMED && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleAction(cancelExpense, t("cancelConfirm"))}
          disabled={isPending}
        >
          {t("cancel")}
        </Button>
      )}
    </div>
  );
}
