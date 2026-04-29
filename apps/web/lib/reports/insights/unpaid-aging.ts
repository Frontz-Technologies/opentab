import { Hourglass } from "lucide-react";
import type { InsightCard, InsightContext } from "./types";

export function unpaidAgingInsight(ctx: InsightContext): InsightCard | null {
  if (ctx.outstanding.overdueTotal <= 0) return null;
  return {
    id: "unpaid-aging",
    type: "risk",
    icon: Hourglass,
    title: "Aging receivables",
    description: `\u20AC${ctx.outstanding.overdueTotal.toLocaleString("en", { minimumFractionDigits: 2 })} in overdue invoices needs attention.`,
    action: { label: "View invoices", href: "/invoices" },
  };
}
