import type { InsightCard } from "@/lib/reports/insights/types";
import Link from "next/link";

// Semantic-token borders per insight type. "warning" here is the
// card-surface-level "attention required" accent — maps to `tertiary`
// (hard-danger) rather than the `warning` (soft-caution) token, since
// the surface signals an actionable risk (overdue receivables, high
// client concentration) rather than a neutral status. "info" uses
// outline-variant for a subtle neutral accent that reads as "fyi".
const borderByType: Record<InsightCard["type"], string> = {
  success: "border-primary/30",
  info: "border-outline-variant/40",
  warning: "border-tertiary/30",
};

export function InsightCardsRow({ insights }: { insights: InsightCard[] }) {
  if (!insights.length) return <></>;
  return (
    // Auto-fit grid: cards stretch to fill available width when few, wrap
    // onto new rows when many. 240 px minimum keeps content legible.
    // Placed above the KPI row on dashboard so all insights are visible
    // without horizontal scrolling — replaces the prior overflow-x-auto.
    <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-4">
      {insights.map((card) => (
        <div
          key={card.id}
          className={`bg-surface-container-low/60 backdrop-blur-sm rounded-2xl p-4 border ${borderByType[card.type]}`}
        >
          <div className="flex items-center gap-2 mb-2">
            <span className="material-symbols-outlined text-lg text-on-surface-variant">
              {card.icon}
            </span>
            <p className="font-bold text-sm text-on-surface">{card.title}</p>
          </div>
          <p className="text-sm text-on-surface-variant">{card.description}</p>
          {card.action && (
            <Link
              href={card.action.href}
              className="text-xs text-primary hover:underline mt-2 inline-block"
            >
              {card.action.label}
            </Link>
          )}
        </div>
      ))}
    </div>
  );
}
