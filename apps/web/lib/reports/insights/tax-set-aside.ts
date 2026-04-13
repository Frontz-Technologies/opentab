import type { InsightCard, InsightContext } from "./types";

export function taxSetAsideInsight(ctx: InsightContext): InsightCard | null {
  if (ctx.countryCode !== "GR" || ctx.revenue.total <= 0) return null;
  const monthlyReserve = Math.round((ctx.revenue.total * 0.35) / 12);
  return {
    id: "tax-set-aside",
    type: "info",
    icon: "savings",
    title: "Tax reserve suggestion",
    description: `Set aside ~\u20AC${monthlyReserve.toLocaleString("en")}/month for taxes (~35% effective rate).`,
  };
}
