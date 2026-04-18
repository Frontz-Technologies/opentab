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
import { Input } from "@/components/ui/input";
import { AnimatedFilterBar } from "@/components/ui/animated-filter-bar";

interface RecurringExpenseListProps {
  items: RecurringExpense[];
}

const statusColors: Record<number, string> = {
  [RECURRING_EXPENSE_STATUS.ACTIVE]: "bg-primary text-on-primary",
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
        <AnimatedFilterBar
          items={filters.map((f) => ({ value: f.key, label: f.label }))}
          value={statusFilter}
          onValueChange={setStatusFilter}
        />
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
        <>
          <div className="hidden md:block">
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
          </div>

          <div className="block md:hidden space-y-3">
            {filtered.map((item) => (
              <Link
                key={item.id}
                href={`/recurring-expenses/${item.id}`}
                className="block bg-surface-container rounded-xl p-4 hover:bg-surface-container-high transition-colors"
              >
                <div className="flex items-start justify-between mb-1">
                  <span className="font-label text-lg font-bold text-on-surface">
                    {item.description || "\u2014"}
                  </span>
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
                </div>
                <div className="flex items-center justify-between">
                  <Badge
                    className="bg-secondary-container text-secondary"
                    variant="outline"
                  >
                    {frequencyLabels[item.frequency] ?? ""}
                  </Badge>
                  <span className="text-xs text-on-surface-variant">
                    {item.nextRunDate}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
