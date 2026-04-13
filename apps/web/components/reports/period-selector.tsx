"use client";

import { useTranslations } from "next-intl";
import type { PeriodKey } from "@/lib/reports/types";

const periods: { key: PeriodKey; labelKey: string }[] = [
  { key: "month", labelKey: "periodMonth" },
  { key: "30days", labelKey: "period30Days" },
  { key: "quarter", labelKey: "periodQuarter" },
  { key: "year", labelKey: "periodYear" },
  { key: "all", labelKey: "periodAll" },
];

export function PeriodSelector({
  selected,
  onChange,
}: {
  selected: PeriodKey;
  onChange: (period: PeriodKey) => void;
}) {
  const t = useTranslations("reports");
  return (
    <div className="flex gap-1 flex-wrap">
      {periods.map(({ key, labelKey }) => (
        <button
          key={key}
          onClick={() => onChange(key)}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            selected === key
              ? "bg-primary/10 text-primary border border-primary"
              : "text-on-surface-variant hover:bg-surface-container-low border border-transparent"
          }`}
        >
          {t(labelKey)}
        </button>
      ))}
    </div>
  );
}
