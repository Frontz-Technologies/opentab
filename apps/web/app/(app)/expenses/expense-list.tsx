"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import type { Expense } from "@opentab/db/schema";
import { Input } from "@/components/ui/input";

interface ExpenseListProps {
  expenses: Expense[];
}

export function ExpenseList({ expenses }: ExpenseListProps) {
  const t = useTranslations("expenses");
  const router = useRouter();
  const [search, setSearch] = useState("");

  const filtered = expenses.filter((exp) => {
    return (
      !search ||
      exp.expenseNumber.toLowerCase().includes(search.toLowerCase()) ||
      (exp.contactName ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (exp.description ?? "").toLowerCase().includes(search.toLowerCase())
    );
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:gap-3">
        <Input
          placeholder={t("searchPlaceholder")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full md:max-w-sm"
        />
      </div>

      {filtered.length === 0 ? (
        expenses.length === 0 ? (
          <div className="flex flex-col items-center text-center py-16 px-6">
            <span className="material-symbols-outlined text-5xl text-on-surface-variant mb-4 block">
              account_balance_wallet
            </span>
            <h3 className="font-headline text-xl font-semibold text-on-surface mb-2">
              {t("noExpenses")}
            </h3>
            <p className="text-sm text-on-surface-variant max-w-sm mb-6">
              {t("noExpensesDescription")}
            </p>
            <Link
              href="/expenses/new"
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-5 font-label text-sm font-medium text-on-primary transition-colors hover:bg-primary/90"
            >
              <span className="material-symbols-outlined text-[18px]">add</span>
              {t("addExpense")}
            </Link>
          </div>
        ) : (
          <div className="text-center py-12 text-on-surface-variant">
            <span className="material-symbols-outlined text-4xl mb-2 block">
              search_off
            </span>
            <p className="text-sm">{t("noResultsMatch")}</p>
          </div>
        )
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
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((expense) => (
                    <tr
                      key={expense.id}
                      className="border-b border-on-surface/5 hover:bg-surface-container-low transition-colors cursor-pointer"
                      onClick={() => router.push(`/expenses/${expense.id}`)}
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
                <span className="text-xs text-on-surface-variant">
                  {expense.expenseDate}
                </span>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
