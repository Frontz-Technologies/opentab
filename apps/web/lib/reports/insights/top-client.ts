import type { InsightCard, InsightContext } from "./types";

export function topClientInsight(ctx: InsightContext): InsightCard | null {
  if (!ctx.revenueByClient.length || ctx.revenue.total <= 0) return null;
  const top = ctx.revenueByClient[0];
  const pct = (top.total / ctx.revenue.total) * 100;
  if (pct < 50) return null;
  return {
    id: "top-client",
    type: "info",
    icon: "User",
    title: "High client concentration",
    description: `${top.displayName} accounts for ${pct.toFixed(0)}% of your revenue.`,
  };
}
