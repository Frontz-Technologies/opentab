"use client";

import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { useLocale, useTranslations } from "next-intl";
import { useChartTheme } from "@/hooks/use-chart-theme";

interface DataPoint {
  bucket: string;
  revenue: number;
  expenses: number;
}

// Renders "2026-01-15" / "2026-01" as a short month label in the user's
// active locale — "Jan" for en, "Ιαν" for el, "ene" for es — via
// Intl.DateTimeFormat. Day suffix preserved when the bucket is a full
// date ("Jan 15"). Falls back to the raw bucket string if parse fails.
function formatBucketLabel(bucket: string, locale: string): string {
  const parts = bucket.split("-");
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10);
  if (!Number.isFinite(year) || !Number.isFinite(month)) return bucket;
  const monthIdx = month - 1;
  if (monthIdx < 0 || monthIdx > 11) return bucket;
  const monthLabel = new Intl.DateTimeFormat(locale, {
    month: "short",
  }).format(new Date(year, monthIdx, 1));
  if (parts.length === 3) return `${monthLabel} ${parts[2]}`;
  return monthLabel;
}

function formatCurrency(value: number): string {
  return `\u20AC${value.toLocaleString("en", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function CustomTooltip({
  active,
  payload,
  label,
  locale,
}: {
  active?: boolean;
  payload?: Array<{ value: number; name: string; color: string }>;
  label?: string;
  locale: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-surface-container rounded-lg border border-outline-variant/20 p-3 shadow-lg">
      <p className="text-xs text-on-surface-variant mb-1">
        {formatBucketLabel(label ?? "", locale)}
      </p>
      {payload.map((entry) => (
        <p
          key={entry.name}
          className="text-sm font-medium"
          style={{ color: entry.color }}
        >
          {entry.name}: {formatCurrency(entry.value)}
        </p>
      ))}
    </div>
  );
}

export function RevenueExpensesChart({ data }: { data: DataPoint[] }) {
  const theme = useChartTheme();
  const locale = useLocale();
  const t = useTranslations("dashboard");
  if (!data.length) return null;
  return (
    <ResponsiveContainer width="100%" height={300}>
      <AreaChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke={theme.grid} />
        <XAxis
          dataKey="bucket"
          tickFormatter={(b: string) => formatBucketLabel(b, locale)}
          tick={{ fill: theme.tickText, fontSize: 12 }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tickFormatter={formatCurrency}
          tick={{ fill: theme.tickText, fontSize: 12 }}
          axisLine={false}
          tickLine={false}
          width={70}
        />
        <Tooltip content={<CustomTooltip locale={locale} />} />
        <Area
          type="monotone"
          dataKey="revenue"
          name={t("revenue")}
          stroke={theme.revenue}
          fill={theme.revenue}
          fillOpacity={0.2}
          strokeWidth={2}
        />
        <Area
          type="monotone"
          dataKey="expenses"
          name={t("expenses")}
          stroke={theme.expense}
          fill={theme.expense}
          fillOpacity={0.2}
          strokeWidth={2}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
