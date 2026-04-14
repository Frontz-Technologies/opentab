"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import type { Quote } from "@opentab/db/schema";
import { QUOTE_STATUS } from "@opentab/db/schema";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { AnimatedFilterBar } from "@/components/ui/animated-filter-bar";

interface QuoteListProps {
  quotes: Quote[];
}

const statusColors: Record<number, string> = {
  [QUOTE_STATUS.DRAFT]: "bg-surface-container-highest text-on-surface-variant",
  [QUOTE_STATUS.SENT]: "bg-secondary-container text-secondary",
  [QUOTE_STATUS.ACCEPTED]: "bg-primary-container/20 text-primary",
  [QUOTE_STATUS.REJECTED]: "bg-tertiary-container/20 text-tertiary",
  [QUOTE_STATUS.CONVERTED]: "bg-primary-container/20 text-primary",
};

type StatusFilter = "all" | "draft" | "sent" | "accepted";

export function QuoteList({ quotes }: QuoteListProps) {
  const t = useTranslations("quotes");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const filtered = quotes.filter((q) => {
    const matchesSearch =
      !search ||
      q.quoteNumber.toLowerCase().includes(search.toLowerCase()) ||
      q.contactName.toLowerCase().includes(search.toLowerCase());

    let matchesStatus = true;
    if (statusFilter === "draft")
      matchesStatus = q.status === QUOTE_STATUS.DRAFT;
    else if (statusFilter === "sent")
      matchesStatus = q.status === QUOTE_STATUS.SENT;
    else if (statusFilter === "accepted")
      matchesStatus = q.status === QUOTE_STATUS.ACCEPTED;

    return matchesSearch && matchesStatus;
  });

  const statusLabels: Record<number, string> = {
    [QUOTE_STATUS.DRAFT]: t("statusDraft"),
    [QUOTE_STATUS.SENT]: t("statusSent"),
    [QUOTE_STATUS.ACCEPTED]: t("statusAccepted"),
    [QUOTE_STATUS.REJECTED]: t("statusRejected"),
    [QUOTE_STATUS.CONVERTED]: t("statusConverted"),
  };

  const filters: { key: StatusFilter; label: string }[] = [
    { key: "all", label: t("filterAll") },
    { key: "draft", label: t("filterDraft") },
    { key: "sent", label: t("filterSent") },
    { key: "accepted", label: t("filterAccepted") },
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
            description
          </span>
          <p className="font-label">{t("noQuotes")}</p>
          <p className="text-sm mt-1">{t("noQuotesDescription")}</p>
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
                  {t("client")}
                </th>
                <th className="text-left px-4 py-3 font-label text-sm text-on-surface/60">
                  {t("issueDate")}
                </th>
                <th className="text-left px-4 py-3 font-label text-sm text-on-surface/60">
                  {t("validUntil")}
                </th>
                <th className="text-right px-4 py-3 font-label text-sm text-on-surface/60">
                  {t("total")}
                </th>
                <th className="text-left px-4 py-3 font-label text-sm text-on-surface/60">
                  {t("status")}
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((quote) => (
                <tr
                  key={quote.id}
                  className="border-b border-on-surface/5 hover:bg-surface-container-low transition-colors"
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/quotes/${quote.id}`}
                      className="text-on-surface hover:text-primary transition-colors font-medium font-mono text-sm"
                    >
                      {quote.quoteNumber}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-on-surface text-sm">
                    {quote.contactName}
                  </td>
                  <td className="px-4 py-3 text-on-surface/60 text-sm">
                    {quote.issueDate}
                  </td>
                  <td className="px-4 py-3 text-on-surface/60 text-sm">
                    {quote.validUntil || "\u2014"}
                  </td>
                  <td className="px-4 py-3 text-on-surface text-sm text-right font-mono">
                    {quote.currencyCode} {quote.total}
                  </td>
                  <td className="px-4 py-3">
                    <Badge
                      className={statusColors[quote.status] ?? ""}
                      variant="outline"
                    >
                      {statusLabels[quote.status]}
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
