"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Trash2 } from "lucide-react";
import type { Expense } from "@opentab/db/schema";
import { Button } from "@/components/ui/button";
import { deleteExpense } from "../actions";

interface ExpenseActionsProps {
  expense: Expense;
}

export function ExpenseActions({ expense }: ExpenseActionsProps) {
  const t = useTranslations("expenses");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <div className="flex gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={() => {
          if (!confirm(t("deleteConfirm"))) return;
          startTransition(async () => {
            const result = await deleteExpense(expense.id);
            if (result.success) {
              router.push("/expenses");
            }
          });
        }}
        disabled={isPending}
      >
        <Trash2 className="h-4 w-4 mr-1" />
        {t("delete")}
      </Button>
    </div>
  );
}
