import type { InsightCard, InsightContext } from "./types";
import { getCountryProvider } from "@/lib/country";

export function taxSetAsideInsight(ctx: InsightContext): InsightCard | null {
  const provider = getCountryProvider(ctx.countryCode);
  if (!provider.capabilities.taxProjection || ctx.revenue.total <= 0)
    return null;
  const monthlyReserve = Math.round((ctx.revenue.total * 0.35) / 12);
  return {
    id: "tax-set-aside",
    type: "info",
    icon: "savings",
    title: "Tax reserve suggestion",
    description: `Set aside ~\u20AC${monthlyReserve.toLocaleString("en")}/month for taxes (~35% effective rate).`,
  };
}
