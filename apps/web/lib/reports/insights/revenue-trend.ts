import type { InsightCard, InsightContext } from "./types";

export function revenueTrendInsight(ctx: InsightContext): InsightCard | null {
  if (ctx.revenue.previousTotal === null || ctx.revenue.previousTotal === 0)
    return null;
  const change =
    ((ctx.revenue.total - ctx.revenue.previousTotal) /
      ctx.revenue.previousTotal) *
    100;
  if (Math.abs(change) < 10) return null;
  const up = change > 0;
  return {
    id: "revenue-trend",
    type: up ? "success" : "risk",
    icon: up ? "trending_up" : "trending_down",
    title: up ? "Revenue is up" : "Revenue is down",
    description: `Revenue changed by ${change > 0 ? "+" : ""}${change.toFixed(1)}% compared to the previous period.`,
  };
}
