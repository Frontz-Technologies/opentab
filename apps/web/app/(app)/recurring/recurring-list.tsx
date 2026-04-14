"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import type { RecurringInvoice } from "@opentab/db/schema";
import { RECURRING_STATUS, FREQUENCY } from "@opentab/db/schema";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { AnimatedFilterBar } from "@/components/ui/animated-filter-bar";

interface RecurringListProps {
  items: RecurringInvoice[];
}

const statusColors: Record<number, string> = {
  [RECURRING_STATUS.ACTIVE]: "bg-emerald-500/20 text-emerald-400",
  [RECURRING_STATUS.PAUSED]: "bg-amber-500/20 text-amber-400",
  [RECURRING_STATUS.COMPLETED]: "bg-zinc-500/20 text-zinc-400",
};

type StatusFilter = "all" | "active" | "paused";

export function RecurringList({ items }: RecurringListProps) {
  const t = useTranslations("recurring");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const frequencyLabels: Record<number, string> = {
    [FREQUENCY.DAILY]: t("frequencyDaily"),
    [FREQUENCY.WEEKLY]: t("frequencyWeekly"),
    [FREQUENCY.BIWEEKLY]: t("frequencyBiweekly"),
    [FREQUENCY.MONTHLY]: t("frequencyMonthly"),
    [FREQUENCY.QUARTERLY]: t("frequencyQuarterly"),
    [FREQUENCY.BIANNUALLY]: t("frequencyBiannually"),
    [FREQUENCY.ANNUALLY]: t("frequencyAnnually"),
  };

  const statusLabels: Record<number, string> = {
    [RECURRING_STATUS.ACTIVE]: t("statusActive"),
    [RECURRING_STATUS.PAUSED]: t("statusPaused"),
    [RECURRING_STATUS.COMPLETED]: t("statusCompleted"),
  };

  const filtered = items.filter((r) => {
    const matchesSearch = !search;

    let matchesStatus = true;
    if (statusFilter === "active")
      matchesStatus = r.status === RECURRING_STATUS.ACTIVE;
    else if (statusFilter === "paused")
      matchesStatus = r.status === RECURRING_STATUS.PAUSED;

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
            autorenew
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
                    {t("client")}
                  </th>
                  <th className="text-left px-4 py-3 font-label text-sm text-on-surface/60">
                    {t("frequency")}
                  </th>
                  <th className="text-left px-4 py-3 font-label text-sm text-on-surface/60">
                    {t("nextSendDate")}
                  </th>
                  <th className="text-left px-4 py-3 font-label text-sm text-on-surface/60">
                    {t("status")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr
                    key={r.id}
                    className="border-b border-on-surface/5 hover:bg-surface-container-low transition-colors"
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={`/recurring/${r.id}`}
                        className="text-on-surface hover:text-primary transition-colors font-medium text-sm"
                      >
                        {r.contactId}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-on-surface text-sm">
                      {frequencyLabels[r.frequency]}
                    </td>
                    <td className="px-4 py-3 text-on-surface/60 text-sm">
                      {r.nextSendDate}
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        className={statusColors[r.status] ?? ""}
                        variant="outline"
                      >
                        {statusLabels[r.status]}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="block md:hidden space-y-3">
          {filtered.map((r) => (
            <Link
              key={r.id}
              href={`/recurring/${r.id}`}
              className="block bg-surface-container rounded-xl p-4 hover:bg-surface-container-high transition-colors"
            >
              <div className="flex items-start justify-between mb-1">
                <span className="font-label text-lg font-bold text-on-surface">{r.contactId}</span>
                <Badge className={statusColors[r.status] ?? ""} variant="outline">{statusLabels[r.status]}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <Badge className="bg-secondary-container text-secondary" variant="outline">{frequencyLabels[r.frequency]}</Badge>
                <span className="text-xs text-on-surface-variant">{r.nextSendDate}</span>
              </div>
            </Link>
          ))}
        </div>
        </>
      )}
    </div>
  );
}
