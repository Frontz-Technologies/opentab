import type { PnlReportData } from "../types";

function escapeCsv(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function pnlToCsv(data: PnlReportData): string {
  const lines: string[] = [];
  lines.push("Section,Item,Amount");

  lines.push(`Revenue,Total,${data.revenue.total.toFixed(2)}`);
  for (const client of data.revenue.byClient) {
    lines.push(
      `Revenue,${escapeCsv(client.displayName)},${client.total.toFixed(2)}`,
    );
  }

  lines.push(`Expenses,Total,${data.expenses.total.toFixed(2)}`);
  for (const cat of data.expenses.byCategory) {
    lines.push(`Expenses,${escapeCsv(cat.category)},${cat.total.toFixed(2)}`);
  }

  lines.push(`Summary,Net Profit,${data.netProfit.toFixed(2)}`);
  lines.push(`Summary,Profit Margin,${data.profitMargin.toFixed(1)}%`);

  return lines.join("\n");
}
