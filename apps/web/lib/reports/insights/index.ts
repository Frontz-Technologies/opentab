import type { InsightCard, InsightContext } from "./types";
import { revenueTrendInsight } from "./revenue-trend";
import { overdueInvoicesInsight } from "./overdue-invoices";
import { vatFilingInsight } from "./vat-filing";
import { expenseSpikeInsight } from "./expense-spike";
import { taxSetAsideInsight } from "./tax-set-aside";
import { cashFlowInsight } from "./cash-flow";
import { topClientInsight } from "./top-client";
import { unpaidAgingInsight } from "./unpaid-aging";

export type { InsightCard, InsightContext };

const generators: Array<(ctx: InsightContext) => InsightCard | null> = [
  revenueTrendInsight,
  overdueInvoicesInsight,
  vatFilingInsight,
  expenseSpikeInsight,
  taxSetAsideInsight,
  cashFlowInsight,
  topClientInsight,
  unpaidAgingInsight,
];

const typePriority: Record<InsightCard["type"], number> = {
  warning: 0,
  info: 1,
  success: 2,
};

export function generateInsights(ctx: InsightContext): InsightCard[] {
  return generators
    .map((gen) => gen(ctx))
    .filter((card): card is InsightCard => card !== null)
    .sort((a, b) => typePriority[a.type] - typePriority[b.type]);
}
