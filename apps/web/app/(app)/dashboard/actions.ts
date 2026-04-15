"use server";

import { getSession } from "@/lib/session";
import type { DashboardData, PeriodKey } from "@/lib/reports/types";
import {
  periodToDateRange,
  previousPeriodRange,
  timeBucket,
} from "@/lib/reports/periods";
import {
  getRevenue,
  getExpenseTotal,
  getOutstanding,
  getCashFlowData,
  getRevenueByClient,
  getExpensesByCategory,
} from "@/lib/reports/queries";
import { getCachedOrCompute } from "@/lib/reports/cache";
import { generateInsights } from "@/lib/reports/insights";
import type { InsightCard } from "@/lib/reports/insights/types";

function changePercent(
  current: number,
  previous: number | null,
): number | null {
  if (previous === null || previous === 0) return null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

function formatEur(n: number): string {
  return `\u20AC${n.toLocaleString("en", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export async function getDashboardData(
  period: PeriodKey,
): Promise<DashboardData & { insights: InsightCard[] }> {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");
  const orgId = session.org.id;

  return getCachedOrCompute(
    `reports:${orgId}:dashboard:${period}`,
    async () => {
      const { start, end } = periodToDateRange(period);
      const prevRange = previousPeriodRange(period);
      const bucket = timeBucket(period);

      // Use Promise.allSettled to prevent one failed query from crashing the dashboard
      const results = await Promise.allSettled([
        getRevenue(orgId, start, end),
        getExpenseTotal(orgId, start, end),
        getOutstanding(orgId),
        prevRange
          ? getRevenue(orgId, prevRange.start, prevRange.end)
          : Promise.resolve(null),
        prevRange
          ? getExpenseTotal(orgId, prevRange.start, prevRange.end)
          : Promise.resolve(null),
        getCashFlowData(orgId, start, end, bucket),
        getRevenueByClient(orgId, start, end),
        getExpensesByCategory(orgId, start, end),
      ]);

      const settled = <T>(r: PromiseSettledResult<T>, fallback: T): T =>
        r.status === "fulfilled" ? r.value : fallback;

      const rev = settled(results[0], { total: 0, count: 0 });
      const exp = settled(results[1], { total: 0, count: 0 });
      const outstanding = settled(results[2], {
        total: 0,
        count: 0,
        overdueTotal: 0,
        overdueCount: 0,
      });
      const prevRev = settled(results[3], null);
      const prevExp = settled(results[4], null);
      const cashFlow = settled(results[5], { revenue: [], expenses: [] });
      const revenueByClient = settled(results[6], []);
      const expensesByCategory = settled(results[7], []);

      const netProfit = rev.total - exp.total;
      const prevNetProfit =
        prevRev && prevExp ? prevRev.total - prevExp.total : null;

      const data: DashboardData = {
        revenue: {
          value: rev.total,
          previousValue: prevRev?.total ?? null,
          changePercent: changePercent(rev.total, prevRev?.total ?? null),
          secondary: `${rev.count} invoice${rev.count !== 1 ? "s" : ""}`,
        },
        expenses: {
          value: exp.total,
          previousValue: prevExp?.total ?? null,
          changePercent: changePercent(exp.total, prevExp?.total ?? null),
          secondary: `${exp.count} expense${exp.count !== 1 ? "s" : ""}`,
        },
        outstanding: {
          value: outstanding.total,
          previousValue: null,
          changePercent: null,
          secondary:
            outstanding.overdueCount > 0
              ? `${outstanding.overdueCount} overdue (${formatEur(outstanding.overdueTotal)})`
              : `${outstanding.count} pending`,
        },
        netProfit: {
          value: netProfit,
          previousValue: prevNetProfit,
          changePercent: changePercent(netProfit, prevNetProfit),
          secondary:
            rev.total > 0
              ? `${((netProfit / rev.total) * 100).toFixed(1)}% margin`
              : "",
        },
        cashFlow,
        revenueByClient,
        expensesByCategory,
        period,
      };

      const insights = generateInsights({
        revenue: {
          total: rev.total,
          previousTotal: prevRev?.total ?? null,
        },
        expenses: {
          total: exp.total,
          previousTotal: prevExp?.total ?? null,
          byCategory: expensesByCategory,
        },
        outstanding: {
          total: outstanding.total,
          overdueTotal: outstanding.overdueTotal,
          overdueCount: outstanding.overdueCount,
        },
        revenueByClient,
        countryCode: session.org.countryCode,
        period,
      });

      return { ...data, insights };
    },
  );
}

export async function hasAnyData(): Promise<boolean> {
  const session = await getSession();
  if (!session) return false;
  const orgId = session.org.id;
  const farPast = new Date(2000, 0, 1);
  const farFuture = new Date(2100, 0, 1);
  const [rev, exp] = await Promise.all([
    getRevenue(orgId, farPast, farFuture),
    getExpenseTotal(orgId, farPast, farFuture),
  ]);
  return rev.count > 0 || exp.count > 0;
}
