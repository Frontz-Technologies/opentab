"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import type { RecurringExpense } from "@opentab/db/schema";
import {
  RECURRING_EXPENSE_STATUS,
  EXPENSE_FREQUENCY,
} from "@opentab/db/schema";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface RecurringExpenseListProps {
  items: RecurringExpense[];
}

const statusColors: Record<number, string> = {
  [RECURRING_EXPENSE_STATUS.ACTIVE]: "bg-emerald-500/20 text-emerald-400",
  [RECURRING_EXPENSE_STATUS.PAUSED]: "bg-amber-500/20 text-amber-400",
  [RECURRING_EXPENSE_STATUS.COMPLETED]: "bg-zinc-500/20 text-zinc-400",
};

const frequencyLabels: Record<number, string> = {
  [EXPENSE_FREQUENCY.DAILY]: "Daily",
  [EXPENSE_FREQUENCY.WEEKLY]: "Weekly",
  [EXPENSE_FREQUENCY.BIWEEKLY]: "Bi-weekly",
  [EXPENSE_FREQUENCY.MONTHLY]: "Monthly",
  [EXPENSE_FREQUENCY.QUARTERLY]: "Quarterly",
  [EXPENSE_FREQUENCY.BIANNUALLY]: "Bi-annually",
  [EXPENSE_FREQUENCY.ANNUALLY]: "Annually",
};

type StatusFilter = "all" | "active" | "paused";

export function RecurringExpenseList({ items }: RecurringExpenseListProps) {
  const t = useTranslations("recurringExpenses");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const filtered = items.filter((item) => {
    const matchesSearch =
      !search ||
      (item.description ?? "").toLowerCase().includes(search.toLowerCase());

    let matchesStatus = true;
    if (statusFilter === "active")
      matchesStatus = item.status === RECURRING_EXPENSE_STATUS.ACTIVE;
    else if (statusFilter === "paused")
      matchesStatus = item.status === RECURRING_EXPENSE_STATUS.PAUSED;

    return matchesSearch && matchesStatus;
  });

  const filters: { key: StatusFilter; label: string }[] = [
    { key: "all", label: t("filterAll") },
    { key: "active", label: t("filterActive") },
    { key: "paused", label: t("filterPaused") },
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
            repeat
          </span>
          <p className="font-label">{t("noRecurring")}</p>
          <p className="text-sm mt-1">{t("noRecurringDescription")}</p>
        </div>
      ) : (
        <div className="bg-surface-container rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-on-surface/10">
                <th className="text-left px-4 py-3 font-label text-sm text-on-surface/60">
                  {t("description")}
                </th>
                <th className="text-left px-4 py-3 font-label text-sm text-on-surface/60">
                  {t("frequency")}
                </th>
                <th className="text-left px-4 py-3 font-label text-sm text-on-surface/60">
                  {t("nextRunDate")}
                </th>
                <th className="text-left px-4 py-3 font-label text-sm text-on-surface/60">
                  {t("status")}
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => (
                <tr
                  key={item.id}
                  className="border-b border-on-surface/5 hover:bg-surface-container-low transition-colors"
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/recurring-expenses/${item.id}`}
                      className="text-on-surface hover:text-primary transition-colors font-medium text-sm"
                    >
                      {item.description || "\u2014"}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-on-surface/60 text-sm">
                    {frequencyLabels[item.frequency] ?? ""}
                  </td>
                  <td className="px-4 py-3 text-on-surface/60 text-sm">
                    {item.nextRunDate}
                  </td>
                  <td className="px-4 py-3">
                    <Badge
                      className={statusColors[item.status] ?? ""}
                      variant="outline"
                    >
                      {item.status === RECURRING_EXPENSE_STATUS.ACTIVE
                        ? t("statusActive")
                        : item.status === RECURRING_EXPENSE_STATUS.PAUSED
                          ? t("statusPaused")
                          : t("statusCompleted")}
                    </Badge>
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
