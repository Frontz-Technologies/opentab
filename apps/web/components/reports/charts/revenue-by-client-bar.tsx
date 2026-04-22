"use client";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";
import { useChartTheme } from "@/hooks/use-chart-theme";

interface ClientData {
  displayName: string;
  total: number;
}

function formatCurrency(value: number): string {
  return `\u20AC${value.toLocaleString("en", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max - 1) + "\u2026" : s;
}

function CustomTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: ClientData }>;
}) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-surface-container rounded-lg border border-outline-variant/20 p-3 shadow-lg">
      <p className="text-sm font-medium text-on-surface">{d.displayName}</p>
      <p className="text-xs text-on-surface-variant">
        {formatCurrency(d.total)}
      </p>
    </div>
  );
}

export function RevenueByClientBar({ data }: { data: ClientData[] }) {
  const theme = useChartTheme();
  if (!data.length) return null;
  const height = Math.max(200, data.length * 40);
  const sum = data.reduce((acc, d) => acc + d.total, 0);
  // Chart + legend row below — mirrors the ExpenseCategoryDonut layout
  // so the two dashboard cards line up visually rather than leaving
  // empty space under this one.
  return (
    <div>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} layout="vertical" margin={{ left: 10 }}>
          <XAxis
            type="number"
            tickFormatter={formatCurrency}
            tick={{ fill: theme.tickText, fontSize: 12 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            type="category"
            dataKey="displayName"
            width={120}
            tickFormatter={(v: string) => truncate(v, 16)}
            tick={{ fill: theme.tickText, fontSize: 12 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip content={<CustomTooltip />} />
          <Bar dataKey="total" fill={theme.primary} radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
      <div className="flex flex-wrap gap-3 justify-center mt-2">
        {[...data]
          .sort((a, b) => b.total - a.total)
          .map((d) => {
            const pct = sum > 0 ? Math.round((d.total / sum) * 1000) / 10 : 0;
            return (
              <div key={d.displayName} className="flex items-center gap-1.5">
                <span
                  className="size-2.5 rounded-full"
                  style={{ backgroundColor: theme.primary }}
                />
                <span className="text-xs text-on-surface-variant">
                  {d.displayName} {formatCurrency(d.total)} ({pct}%)
                </span>
              </div>
            );
          })}
      </div>
    </div>
  );
}
