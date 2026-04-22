"use client";

import { useState, useTransition, useEffect, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import type { DashboardData, PeriodKey } from "@/lib/reports/types";
import type { InsightCard } from "@/lib/reports/insights/types";
import { PeriodSelector } from "@/components/reports/period-selector";
import { KpiCard } from "@/components/reports/kpi-card";
import { RevenueExpensesChart } from "@/components/reports/charts/revenue-expenses-chart";
import { ExpenseCategoryDonut } from "@/components/reports/charts/expense-category-donut";
import { RevenueByClientBar } from "@/components/reports/charts/revenue-by-client-bar";
import { InsightCardsRow } from "@/components/reports/insight-cards-row";
import { getDashboardData } from "./actions";
import { useTranslations } from "next-intl";
import { formatCurrencyCompact } from "@/lib/utils";

function mergeChartData(
  revenue: Array<{ bucket: string; total: number }>,
  expenses: Array<{ bucket: string; total: number }>,
) {
  const map = new Map<
    string,
    { bucket: string; revenue: number; expenses: number }
  >();
  for (const r of revenue) {
    map.set(r.bucket, {
      bucket: r.bucket,
      revenue: r.total,
      expenses: 0,
    });
  }
  for (const e of expenses) {
    const existing = map.get(e.bucket);
    if (existing) {
      existing.expenses = e.total;
    } else {
      map.set(e.bucket, {
        bucket: e.bucket,
        revenue: 0,
        expenses: e.total,
      });
    }
  }
  return Array.from(map.values()).sort((a, b) =>
    a.bucket.localeCompare(b.bucket),
  );
}

export function DashboardClient({
  initialData,
  initialInsights,
}: {
  initialData: DashboardData;
  initialInsights: InsightCard[];
}) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const t = useTranslations("dashboard");

  const periodParam = (searchParams.get("period") as PeriodKey) || "month";
  const [data, setData] = useState(initialData);
  const [insights, setInsights] = useState(initialInsights);
  const [period, setPeriod] = useState<PeriodKey>(periodParam);

  const loadData = useCallback(
    (p: PeriodKey) => {
      startTransition(async () => {
        const result = await getDashboardData(p);
        const { insights: newInsights, ...dashData } = result;
        setData(dashData);
        setInsights(newInsights);
      });
    },
    [startTransition],
  );

  useEffect(() => {
    if (period !== initialData.period) {
      loadData(period);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handlePeriodChange = (p: PeriodKey) => {
    setPeriod(p);
    router.replace(`/dashboard?period=${p}`, { scroll: false });
    loadData(p);
  };

  const chartData = mergeChartData(
    data.cashFlow.revenue,
    data.cashFlow.expenses,
  );

  return (
    <div className={isPending ? "opacity-60 transition-opacity" : ""}>
      <div className="mb-6">
        <PeriodSelector selected={period} onChange={handlePeriodChange} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <KpiCard
          label={t("revenue")}
          value={formatCurrencyCompact(data.revenue.value, "EUR")}
          icon="trending_up"
          changePercent={data.revenue.changePercent}
          secondary={data.revenue.secondary}
          variant="hero"
        />
        <KpiCard
          label={t("outstanding")}
          value={formatCurrencyCompact(data.outstanding.value, "EUR")}
          icon="schedule"
          changePercent={data.outstanding.changePercent}
          secondary={data.outstanding.secondary}
        />
        <KpiCard
          label={t("expenses")}
          value={formatCurrencyCompact(data.expenses.value, "EUR")}
          icon="payments"
          changePercent={data.expenses.changePercent}
          secondary={data.expenses.secondary}
        />
        <KpiCard
          label={t("netProfit")}
          value={formatCurrencyCompact(data.netProfit.value, "EUR")}
          icon="savings"
          changePercent={data.netProfit.changePercent}
          secondary={data.netProfit.secondary}
        />
      </div>

      <div className="bg-surface-container-low rounded-2xl p-6 mb-8">
        <h3 className="font-label text-sm text-on-surface-variant mb-4">
          {t("revenue")} vs {t("expenses")}
        </h3>
        {chartData.length > 0 ? (
          <RevenueExpensesChart data={chartData} />
        ) : (
          <div className="flex items-center justify-center h-[300px]">
            <p className="text-on-surface-variant text-sm">{t("noData")}</p>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        <div className="bg-surface-container-low rounded-2xl p-6 border border-outline-variant/10">
          <h3 className="font-label text-sm text-on-surface-variant mb-4">
            {t("expenses")}
          </h3>
          {data.expensesByCategory.length > 0 ? (
            <ExpenseCategoryDonut
              data={data.expensesByCategory}
              totalExpenses={data.expenses.value}
            />
          ) : (
            <div className="flex items-center justify-center h-[200px]">
              <p className="text-on-surface-variant text-sm">{t("noData")}</p>
            </div>
          )}
        </div>
        <div className="bg-surface-container-low rounded-2xl p-6 border border-outline-variant/10">
          <h3 className="font-label text-sm text-on-surface-variant mb-4">
            {t("revenue")}
          </h3>
          {data.revenueByClient.length > 0 ? (
            <RevenueByClientBar data={data.revenueByClient} />
          ) : (
            <div className="flex items-center justify-center h-[200px]">
              <p className="text-on-surface-variant text-sm">{t("noData")}</p>
            </div>
          )}
        </div>
      </div>

      <InsightCardsRow insights={insights} />
    </div>
  );
}
