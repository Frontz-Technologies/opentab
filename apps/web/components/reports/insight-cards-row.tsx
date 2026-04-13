import type { InsightCard } from "@/lib/reports/insights/types";
import Link from "next/link";

const borderByType: Record<InsightCard["type"], string> = {
  success: "border-emerald-500/30",
  info: "border-blue-500/30",
  warning: "border-red-400/30",
};

export function InsightCardsRow({ insights }: { insights: InsightCard[] }) {
  if (!insights.length) return <></>;
  return (
    <div className="flex overflow-x-auto gap-4 pb-2">
      {insights.map((card) => (
        <div
          key={card.id}
          className={`bg-surface-container-low/60 backdrop-blur-sm rounded-2xl p-4 min-w-[240px] border ${borderByType[card.type]}`}
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
