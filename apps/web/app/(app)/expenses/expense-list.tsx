"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import type { Expense } from "@opentab/db/schema";
import { EXPENSE_STATUS } from "@opentab/db/schema";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { AnimatedFilterBar } from "@/components/ui/animated-filter-bar";

interface ExpenseListProps {
  expenses: Expense[];
}

const statusColors: Record<number, string> = {
  [EXPENSE_STATUS.DRAFT]:
    "bg-surface-container-highest text-on-surface-variant",
  [EXPENSE_STATUS.CONFIRMED]: "bg-primary-container/20 text-primary",
  [EXPENSE_STATUS.CANCELLED]: "bg-tertiary-container/20 text-tertiary",
};

type StatusFilter = "all" | "draft" | "confirmed" | "cancelled";

export function ExpenseList({ expenses }: ExpenseListProps) {
  const t = useTranslations("expenses");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const filtered = expenses.filter((exp) => {
    const matchesSearch =
      !search ||
      exp.expenseNumber.toLowerCase().includes(search.toLowerCase()) ||
      (exp.contactName ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (exp.description ?? "").toLowerCase().includes(search.toLowerCase());

    let matchesStatus = true;
    if (statusFilter === "draft")
      matchesStatus = exp.status === EXPENSE_STATUS.DRAFT;
    else if (statusFilter === "confirmed")
      matchesStatus = exp.status === EXPENSE_STATUS.CONFIRMED;
    else if (statusFilter === "cancelled")
      matchesStatus = exp.status === EXPENSE_STATUS.CANCELLED;

    return matchesSearch && matchesStatus;
  });

  const filters: { key: StatusFilter; label: string }[] = [
    { key: "all", label: t("filterAll") },
    { key: "draft", label: t("filterDraft") },
    { key: "confirmed", label: t("filterConfirmed") },
    { key: "cancelled", label: t("filterCancelled") },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Input
          placeholder={t("searchPlaceholder")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />
        <AnimatedFilterBar
          items={filters.map((f) => ({ value: f.key, label: f.label }))}
          value={statusFilter}
          onValueChange={setStatusFilter}
        />
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-12 text-on-surface/50">
          <span className="material-symbols-outlined text-4xl mb-2 block">
            account_balance_wallet
          </span>
          <p className="font-label">{t("noExpenses")}</p>
          <p className="text-sm mt-1">{t("noExpensesDescription")}</p>
        </div>
      ) : (
        <>
          <div className="hidden md:block">
            <div className="bg-surface-container rounded-xl overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-on-surface/10">
                    <th className="text-left px-4 py-3 font-label text-sm text-on-surface/60">
                      {t("number")}
                    </th>
                    <th className="text-left px-4 py-3 font-label text-sm text-on-surface/60">
                      {t("supplier")}
                    </th>
                    <th className="text-left px-4 py-3 font-label text-sm text-on-surface/60">
                      {t("expenseDate")}
                    </th>
                    <th className="text-right px-4 py-3 font-label text-sm text-on-surface/60">
                      {t("total")}
                    </th>
                    <th className="text-left px-4 py-3 font-label text-sm text-on-surface/60">
                      {t("source")}
                    </th>
                    <th className="text-left px-4 py-3 font-label text-sm text-on-surface/60">
                      {t("status")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((expense) => (
                    <tr
                      key={expense.id}
                      className="border-b border-on-surface/5 hover:bg-surface-container-low transition-colors"
                    >
                      <td className="px-4 py-3">
                        <Link
                          href={`/expenses/${expense.id}`}
                          className="text-on-surface hover:text-primary transition-colors font-medium font-mono text-sm"
                        >
                          {expense.expenseNumber}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-on-surface text-sm">
                        {expense.contactName || "\u2014"}
                      </td>
                      <td className="px-4 py-3 text-on-surface/60 text-sm">
                        {expense.expenseDate}
                      </td>
                      <td className="px-4 py-3 text-on-surface text-sm text-right font-mono">
                        {expense.currencyCode} {expense.total}
                      </td>
                      <td className="px-4 py-3 text-on-surface/60 text-sm capitalize">
                        {expense.source}
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          className={statusColors[expense.status] ?? ""}
                          variant="outline"
                        >
                          {expense.status === EXPENSE_STATUS.DRAFT
                            ? t("statusDraft")
                            : expense.status === EXPENSE_STATUS.CONFIRMED
                              ? t("statusConfirmed")
                              : t("statusCancelled")}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="block md:hidden space-y-3">
            {filtered.map((expense) => (
              <Link
                key={expense.id}
                href={`/expenses/${expense.id}`}
                className="block bg-surface-container rounded-xl p-4 hover:bg-surface-container-high transition-colors"
              >
                <div className="flex items-start justify-between mb-1">
                  <span className="font-mono text-sm text-on-surface">
                    {expense.expenseNumber}
                  </span>
                  <span className="font-label text-lg font-bold text-on-surface">
                    {expense.currencyCode} {expense.total}
                  </span>
                </div>
                <p className="text-sm text-on-surface mb-2">
                  {expense.contactName || expense.description || "\u2014"}
                </p>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-on-surface-variant">
                    {expense.expenseDate}
                  </span>
                  <Badge
                    className={statusColors[expense.status] ?? ""}
                    variant="outline"
                  >
                    {expense.status === EXPENSE_STATUS.DRAFT
                      ? t("statusDraft")
                      : expense.status === EXPENSE_STATUS.CONFIRMED
                        ? t("statusConfirmed")
                        : t("statusCancelled")}
                  </Badge>
                </div>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
