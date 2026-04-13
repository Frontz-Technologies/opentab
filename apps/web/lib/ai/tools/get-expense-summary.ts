import { tool, zodSchema } from "ai";
import { z } from "zod";
import { getExpenseTotal, getExpensesByCategory } from "@/lib/reports/queries";
import { resolvePeriodRange } from "./shared";

export function createGetExpenseSummaryTool(orgId: string) {
  const parameters = z.object({
    period: z.enum(["month", "quarter", "year"]),
    year: z.number().int().optional(),
    quarter: z.number().int().min(1).max(4).optional(),
    month: z.number().int().min(1).max(12).optional(),
  });

  return tool({
    description: "Get expense totals and category breakdown for a time period.",
    parameters: zodSchema(parameters),
    execute: async (args) => {
      const { period, year, quarter, month } = parameters.parse(args);
      const { start, end } = resolvePeriodRange({
        period,
        year,
        quarter,
        month,
      });
      const [summary, categories] = await Promise.all([
        getExpenseTotal(orgId, start, end),
        getExpensesByCategory(orgId, start, end),
      ]);

      return {
        total: summary.total,
        expenseCount: summary.count,
        byCategory: categories.map((category) => ({
          category: category.category,
          total: category.total,
        })),
      };
    },
  });
}
