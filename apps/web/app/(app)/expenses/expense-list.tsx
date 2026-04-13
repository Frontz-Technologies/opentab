"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import type { Expense } from "@opentab/db/schema";
import { EXPENSE_STATUS, EXPENSE_SOURCE } from "@opentab/db/schema";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface ExpenseListProps {
  expenses: Expense[];
}

const statusColors: Record<number, string> = {
  [EXPENSE_STATUS.DRAFT]: "bg-zinc-500/20 text-zinc-400",
  [EXPENSE_STATUS.CONFIRMED]: "bg-emerald-500/20 text-emerald-400",
  [EXPENSE_STATUS.CANCELLED]: "bg-red-500/20 text-red-400",
};

const sourceIcons: Record<string, string> = {
  [EXPENSE_SOURCE.MANUAL]: "edit",
  [EXPENSE_SOURCE.EMAIL]: "mail",
  [EXPENSE_SOURCE.AI_EXTRACT]: "auto_awesome",
  [EXPENSE_SOURCE.RECURRING]: "repeat",
};

function getStatusLabel(
  expense: Expense,
  t: ReturnType<typeof useTranslations>,
): string {
  const labels: Record<number, string> = {
    [EXPENSE_STATUS.DRAFT]: t("statusDraft"),
    [EXPENSE_STATUS.CONFIRMED]: t("statusConfirmed"),
    [EXPENSE_STATUS.CANCELLED]: t("statusCancelled"),
  };
  return labels[expense.status] ?? "";
}

type StatusFilter = "all" | "draft" | "confirmed";

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

    return matchesSearch && matchesStatus;
  });

  const filters: { key: StatusFilter; label: string }[] = [
    { key: "all", label: t("filterAll") },
    { key: "draft", label: t("filterDraft") },
    { key: "confirmed", label: t("filterConfirmed") },
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
        <div className="flex gap-1">
          {filters.map((f) => (
            <Button
              key={f.key}
              variant={statusFilter === f.key ? "default" : "outline"}
              size="sm"
              onClick={() => setStatusFilter(f.key)}
            >
              {f.label}
            </Button>
          ))}
        </div>
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
                  {t("issueDate")}
                </th>
                <th className="text-right px-4 py-3 font-label text-sm text-on-surface/60">
                  {t("total")}
                </th>
                <th className="text-left px-4 py-3 font-label text-sm text-on-surface/60">
                  {t("status")}
                </th>
                <th className="text-center px-4 py-3 font-label text-sm text-on-surface/60 w-10">
                  &nbsp;
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
                    {expense.issueDate}
                  </td>
                  <td className="px-4 py-3 text-on-surface text-sm text-right font-mono">
                    {expense.currencyCode} {expense.total}
                  </td>
                  <td className="px-4 py-3">
                    <Badge
                      className={statusColors[expense.status] ?? ""}
                      variant="outline"
                    >
                      {getStatusLabel(expense, t)}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className="material-symbols-outlined text-[16px] text-on-surface/40"
                      title={expense.source}
                    >
                      {sourceIcons[expense.source] ?? "edit"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
