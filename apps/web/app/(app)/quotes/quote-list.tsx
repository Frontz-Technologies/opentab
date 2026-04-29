"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
  [QUOTE_STATUS.SENT]: "bg-secondary-container text-on-secondary-container",
  [QUOTE_STATUS.ACCEPTED]: "bg-primary-container/20 text-primary",
  [QUOTE_STATUS.REJECTED]: "bg-tertiary-container/20 text-tertiary",
  [QUOTE_STATUS.CONVERTED]: "bg-primary-container/20 text-primary",
};

type StatusFilter = "all" | "draft" | "sent" | "accepted";

export function QuoteList({ quotes }: QuoteListProps) {
  const t = useTranslations("quotes");
  const router = useRouter();
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
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between md:gap-3">
        <Input
          placeholder={t("searchPlaceholder")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full md:flex-1 md:max-w-md"
        />
        <AnimatedFilterBar
          items={filters.map((f) => ({ value: f.key, label: f.label }))}
          value={statusFilter}
          onValueChange={setStatusFilter}
        />
      </div>

      {filtered.length === 0 ? (
        quotes.length === 0 ? (
          <div className="flex flex-col items-center text-center py-16 px-6">
            <span className="material-symbols-outlined text-5xl text-on-surface-variant mb-4 block">
              description
            </span>
            <h3 className="font-headline text-xl font-semibold text-on-surface mb-2">
              {t("noQuotes")}
            </h3>
            <p className="text-sm text-on-surface-variant max-w-sm mb-6">
              {t("noQuotesDescription")}
            </p>
            <Link
              href="/quotes/new"
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-5 font-label text-sm font-medium text-on-primary transition-colors hover:bg-primary/90"
            >
              <span className="material-symbols-outlined text-[18px]">add</span>
              {t("addQuote")}
            </Link>
          </div>
        ) : (
          <div className="text-center py-12 text-on-surface-variant">
            <span className="material-symbols-outlined text-4xl mb-2 block">
              description
            </span>
            <p className="font-label">{t("noQuotesMatch")}</p>
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
                      className="border-b border-on-surface/5 hover:bg-surface-container-low transition-colors cursor-pointer"
                      onClick={() => router.push(`/quotes/${quote.id}`)}
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
          </div>

          <div className="block md:hidden space-y-3">
            {filtered.map((quote) => (
              <Link
                key={quote.id}
                href={`/quotes/${quote.id}`}
                className="block bg-surface-container rounded-xl p-4 hover:bg-surface-container-high transition-colors"
              >
                <div className="flex items-start justify-between mb-1">
                  <span className="font-mono text-sm text-on-surface">
                    {quote.quoteNumber}
                  </span>
                  <span className="font-label text-lg font-bold text-on-surface">
                    {quote.currencyCode} {quote.total}
                  </span>
                </div>
                <p className="text-sm text-on-surface mb-2">
                  {quote.contactName}
                </p>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-on-surface-variant">
                    {quote.issueDate}
                  </span>
                  <Badge
                    className={statusColors[quote.status] ?? ""}
                    variant="outline"
                  >
                    {statusLabels[quote.status]}
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
