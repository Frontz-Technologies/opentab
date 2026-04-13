import type { InsightCard, InsightContext } from "./types";

export function expenseSpikeInsight(ctx: InsightContext): InsightCard | null {
  const cats = ctx.expenses.byCategory;
  if (cats.length < 2) return null;
  const avg = cats.reduce((s, c) => s + c.total, 0) / cats.length;
  if (avg === 0) return null;
  const spike = cats.find((c) => c.total > avg * 2);
  if (!spike) return null;
  return {
    id: "expense-spike",
    type: "warning",
    icon: "trending_up",
    title: `Expense spike: ${spike.category}`,
    description: `${spike.category} is ${(spike.total / avg).toFixed(1)}x the average category spend.`,
  };
}
