import type { InsightCard, InsightContext } from "./types";

export function overdueInvoicesInsight(
  ctx: InsightContext,
): InsightCard | null {
  if (ctx.outstanding.overdueCount <= 0) return null;
  return {
    id: "overdue-invoices",
    type: "risk",
    icon: "AlertTriangle",
    title: `${ctx.outstanding.overdueCount} overdue invoice${ctx.outstanding.overdueCount > 1 ? "s" : ""}`,
    description: `\u20AC${ctx.outstanding.overdueTotal.toLocaleString("en", { minimumFractionDigits: 2 })} is past due.`,
    action: { label: "View overdue", href: "/invoices?filter=overdue" },
  };
}
