import type { InsightCard, InsightContext } from "./types";

export function cashFlowInsight(ctx: InsightContext): InsightCard | null {
  if (ctx.revenue.previousTotal === null || ctx.revenue.previousTotal === 0)
    return null;
  const change =
    ((ctx.revenue.total - ctx.revenue.previousTotal) /
      ctx.revenue.previousTotal) *
    100;
  if (Math.abs(change) < 15) return null;
  const up = change > 0;
  return {
    id: "cash-flow",
    type: up ? "success" : "risk",
    icon: "account_balance",
    title: up ? "Cash flow improving" : "Cash flow declining",
    description: `Revenue ${up ? "increased" : "decreased"} by ${Math.abs(change).toFixed(1)}% vs previous period.`,
  };
}
