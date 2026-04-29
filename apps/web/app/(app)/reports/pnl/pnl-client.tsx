"use client";

import { useState, useTransition, useEffect } from "react";
import { format, parseISO } from "date-fns";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { type DateRange } from "react-day-picker";
import type { PnlReportData } from "@/lib/reports/types";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { getPnlReport, exportPnlCsv } from "../actions";
import { ExpenseCategoryDonut } from "@/components/reports/charts/expense-category-donut";

type Preset = "month" | "quarter" | "year";

function formatEur(n: number): string {
  return `\u20AC${n.toLocaleString("en", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function ChangeIndicator({ value }: { value: number | null }) {
  if (value === null) return null;
  const positive = value >= 0;
  return (
    <span
      className={`text-xs font-medium ${positive ? "text-primary" : "text-tertiary"}`}
    >
      {positive ? "+" : ""}
      {value.toFixed(1)}%
    </span>
  );
}

function SkeletonGrid() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-8">
      {[0, 1, 2, 3].map((i) => (
        <div
          key={i}
          className="bg-surface-container-low rounded-2xl p-4 h-24 animate-pulse"
        />
      ))}
    </div>
  );
}

export function PnlClient({
  defaultStart,
  defaultEnd,
}: {
  defaultStart: string;
  defaultEnd: string;
}) {
  const t = useTranslations("reports");
  const [startDate, setStartDate] = useState(defaultStart);
  const [endDate, setEndDate] = useState(defaultEnd);
  const [data, setData] = useState<PnlReportData | null>(null);
  const [isPending, startTransition] = useTransition();
  const [activePreset, setActivePreset] = useState<Preset | null>("month");

  useEffect(() => {
    startTransition(async () => {
      const result = await getPnlReport(startDate, endDate);
      setData(result);
    });
  }, [startDate, endDate]);

  const handleExport = () => {
    startTransition(async () => {
      const csv = await exportPnlCsv(startDate, endDate);
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `pnl-${startDate}-${endDate}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    });
  };

  const setPreset = (preset: Preset) => {
    const now = new Date();
    let s: Date;
    let e: Date;
    switch (preset) {
      case "month":
        s = new Date(now.getFullYear(), now.getMonth(), 1);
        e = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        break;
      case "quarter": {
        const q = Math.floor(now.getMonth() / 3);
        s = new Date(now.getFullYear(), q * 3, 1);
        e = new Date(now.getFullYear(), q * 3 + 3, 0);
        break;
      }
      case "year":
        s = new Date(now.getFullYear(), 0, 1);
        e = new Date(now.getFullYear(), 11, 31);
        break;
    }
    setActivePreset(preset);
    setStartDate(s.toISOString().slice(0, 10));
    setEndDate(e.toISOString().slice(0, 10));
  };

  const handleRangeChange = (range: DateRange | undefined) => {
    setActivePreset(null);
    if (range?.from) setStartDate(format(range.from, "yyyy-MM-dd"));
    if (range?.to) setEndDate(format(range.to, "yyyy-MM-dd"));
  };

  const range: DateRange | undefined = startDate
    ? {
        from: parseISO(startDate),
        to: endDate ? parseISO(endDate) : undefined,
      }
    : undefined;

  const isEmpty =
    data !== null &&
    data.revenue.byClient.length === 0 &&
    data.expenses.byCategory.length === 0;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 mb-8">
        <div className="w-72">
          <DateRangePicker
            value={range}
            onChange={handleRangeChange}
            ariaLabel={t("dateRange")}
          />
        </div>
        <div className="flex gap-1 ml-auto">
          {(["month", "quarter", "year"] as const).map((p) => {
            const active = activePreset === p;
            return (
              <button
                key={p}
                onClick={() => setPreset(p)}
                className={`px-3 py-1.5 rounded-full text-xs font-label uppercase tracking-wider transition-colors ${
                  active
                    ? "bg-primary-container/20 text-primary"
                    : "text-on-surface-variant hover:bg-surface-container-high"
                }`}
              >
                {t(`period${p.charAt(0).toUpperCase() + p.slice(1)}`)}
              </button>
            );
          })}
        </div>
      </div>

      {data === null && isPending && <SkeletonGrid />}

      {isEmpty && (
        <div className="bg-surface-container-low rounded-2xl p-12 flex flex-col items-center text-center">
          <span className="material-symbols-outlined text-5xl text-on-surface-variant mb-4 block">
            monitoring
          </span>
          <h3 className="font-headline text-xl font-semibold text-on-surface mb-2">
            {t("pnlEmptyTitle")}
          </h3>
          <p className="text-sm text-on-surface-variant max-w-md mb-6">
            {t("pnlEmptySubtext")}
          </p>
          <div className="flex flex-wrap gap-3 justify-center">
            <Link
              href="/invoices/new"
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-5 font-label text-sm font-medium text-on-primary transition-colors hover:bg-primary/90"
            >
              <span className="material-symbols-outlined text-[18px]">add</span>
              {t("createInvoiceCta")}
            </Link>
            <Link
              href="/expenses/new"
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-surface-container-high px-5 font-label text-sm font-medium text-on-surface transition-colors hover:bg-surface-container-highest"
            >
              <span className="material-symbols-outlined text-[18px]">add</span>
              {t("recordExpenseCta")}
            </Link>
          </div>
        </div>
      )}

      {data && !isEmpty && (
        <div className={isPending ? "opacity-60 transition-opacity" : ""}>
          {/* Summary */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-8">
            <div className="bg-surface-container-low rounded-2xl p-4">
              <p className="text-xs text-on-surface-variant uppercase tracking-widest mb-1">
                {t("revenue")}
              </p>
              <p className="text-xl font-bold text-on-surface">
                {formatEur(data.revenue.total)}
              </p>
              <ChangeIndicator value={data.comparison.revenueChange} />
            </div>
            <div className="bg-surface-container-low rounded-2xl p-4">
              <p className="text-xs text-on-surface-variant uppercase tracking-widest mb-1">
                {t("expenses")}
              </p>
              <p className="text-xl font-bold text-on-surface">
                {formatEur(data.expenses.total)}
              </p>
              <ChangeIndicator value={data.comparison.expenseChange} />
            </div>
            <div className="bg-surface-container-low rounded-2xl p-4">
              <p className="text-xs text-on-surface-variant uppercase tracking-widest mb-1">
                {t("netProfit")}
              </p>
              <p className="text-xl font-bold text-on-surface">
                {formatEur(data.netProfit)}
              </p>
              <ChangeIndicator value={data.comparison.profitChange} />
            </div>
            <div className="bg-surface-container-low rounded-2xl p-4">
              <p className="text-xs text-on-surface-variant uppercase tracking-widest mb-1">
                {t("profitMargin")}
              </p>
              <p className="text-xl font-bold text-on-surface">
                {data.profitMargin.toFixed(1)}%
              </p>
            </div>
          </div>

          {/* Revenue by Client */}
          <div className="bg-surface-container-low rounded-2xl p-6 mb-8">
            <h3 className="font-label text-sm text-on-surface-variant mb-4">
              {t("revenue")} {t("byClient")}
            </h3>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-on-surface-variant text-xs uppercase tracking-widest border-b border-outline-variant/10">
                  <th className="text-left py-2">{t("client")}</th>
                  <th className="text-right py-2">{t("invoiceCount")}</th>
                  <th className="text-right py-2">{t("total")}</th>
                </tr>
              </thead>
              <tbody>
                {data.revenue.byClient.map((c) => (
                  <tr
                    key={c.contactId}
                    className="border-b border-outline-variant/5"
                  >
                    <td className="py-2 text-on-surface">{c.displayName}</td>
                    <td className="py-2 text-right font-mono text-on-surface-variant">
                      {c.invoiceCount}
                    </td>
                    <td className="py-2 text-right font-mono text-on-surface">
                      {formatEur(c.total)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Expenses by Category */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
            <div className="bg-surface-container-low rounded-2xl p-6">
              <h3 className="font-label text-sm text-on-surface-variant mb-4">
                {t("expenses")} {t("byCategory")}
              </h3>
              {data.expenses.byCategory.length > 0 ? (
                <ExpenseCategoryDonut
                  data={data.expenses.byCategory}
                  totalExpenses={data.expenses.total}
                />
              ) : (
                <p className="text-on-surface-variant text-sm">{t("noData")}</p>
              )}
            </div>
            <div className="bg-surface-container-low rounded-2xl p-6">
              <h3 className="font-label text-sm text-on-surface-variant mb-4">
                {t("expenses")} {t("byCategory")}
              </h3>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-on-surface-variant text-xs uppercase tracking-widest border-b border-outline-variant/10">
                    <th className="text-left py-2">{t("category")}</th>
                    <th className="text-right py-2">{t("amount")}</th>
                    <th className="text-right py-2">{t("percentage")}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.expenses.byCategory.map((c) => (
                    <tr
                      key={c.categoryId}
                      className="border-b border-outline-variant/5"
                    >
                      <td className="py-2 text-on-surface">{c.category}</td>
                      <td className="py-2 text-right font-mono text-on-surface">
                        {formatEur(c.total)}
                      </td>
                      <td className="py-2 text-right font-mono text-on-surface-variant">
                        {c.percentage.toFixed(1)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Export */}
          <div className="flex gap-3">
            <button
              onClick={handleExport}
              className="px-4 py-2 rounded-lg bg-surface-container-high text-on-surface text-sm font-medium hover:bg-surface-container-highest transition-colors"
            >
              {t("exportCsv")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
