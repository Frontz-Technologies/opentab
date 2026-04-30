import type { InsightCard, InsightContext } from "./types";
import { getCountryProvider } from "@/lib/country";

export function vatFilingInsight(ctx: InsightContext): InsightCard | null {
  const provider = getCountryProvider(ctx.countryCode);
  if (!provider.capabilities.vatReport) return null;
  const now = new Date();
  const month = now.getMonth();
  // Quarter ends: Mar 31, Jun 30, Sep 30, Dec 31
  const quarterEndMonth = Math.floor(month / 3) * 3 + 2;
  const quarterEnd = new Date(now.getFullYear(), quarterEndMonth + 1, 0);
  const daysUntil = Math.ceil(
    (quarterEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
  );
  if (daysUntil > 20) return null;
  return {
    id: "vat-filing",
    type: "info",
    icon: "Calendar",
    title: "VAT filing deadline approaching",
    description: `${daysUntil} day${daysUntil !== 1 ? "s" : ""} until quarter end. Prepare your VAT report.`,
    action: { label: "View VAT report", href: "/reports/vat" },
  };
}
