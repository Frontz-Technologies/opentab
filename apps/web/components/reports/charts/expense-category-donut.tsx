"use client";

import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from "recharts";

const COLORS = [
  "#4EDEA3",
  "#60A5FA",
  "#FBBF24",
  "#A78BFA",
  "#FB7185",
  "#2DD4BF",
  "#FB923C",
  "#94A3B8",
];

interface CategoryData {
  category: string;
  total: number;
  percentage: number;
}

function formatCurrency(value: number): string {
  return `\u20AC${value.toLocaleString("en", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function CustomTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: CategoryData }>;
}) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-surface-container rounded-lg border border-outline-variant/20 p-3 shadow-lg">
      <p className="text-sm font-medium text-on-surface">{d.category}</p>
      <p className="text-xs text-on-surface-variant">
        {formatCurrency(d.total)} ({d.percentage}%)
      </p>
    </div>
  );
}

export function ExpenseCategoryDonut({
  data,
  totalExpenses,
}: {
  data: CategoryData[];
  totalExpenses: number;
}) {
  if (!data.length) return null;
  return (
    <div className="relative">
      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie
            data={data}
            dataKey="total"
            nameKey="category"
            cx="50%"
            cy="40%"
            innerRadius={60}
            outerRadius={90}
          >
            {data.map((_, i) => (
              <Cell
                key={i}
                fill={COLORS[i % COLORS.length]}
                stroke="transparent"
              />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
        </PieChart>
      </ResponsiveContainer>
      <div className="absolute top-[40%] left-1/2 -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none">
        <p className="text-lg font-bold text-on-surface">
          {formatCurrency(totalExpenses)}
        </p>
        <p className="text-xs text-on-surface-variant">Total</p>
      </div>
      <div className="flex flex-wrap gap-3 justify-center mt-2">
        {data
          .sort((a, b) => b.total - a.total)
          .map((d, i) => (
            <div key={d.category} className="flex items-center gap-1.5">
              <span
                className="size-2.5 rounded-full"
                style={{
                  backgroundColor: COLORS[i % COLORS.length],
                }}
              />
              <span className="text-xs text-on-surface-variant">
                {d.category} {formatCurrency(d.total)} ({d.percentage}%)
              </span>
            </div>
          ))}
      </div>
    </div>
  );
}
