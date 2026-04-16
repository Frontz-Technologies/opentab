import { defineTool } from "./define-tool";
import { z } from "zod";
import { getRevenue, getRevenueByClient } from "@/lib/reports/queries";
import { resolvePeriodRange } from "./shared";

export function createGetRevenueSummaryTool(orgId: string) {
  const parameters = z.object({
    period: z.enum(["month", "quarter", "year"]),
    year: z.number().int().optional(),
    quarter: z.number().int().min(1).max(4).optional(),
    month: z.number().int().min(1).max(12).optional(),
  });

  return defineTool({
    description: "Get revenue totals and top clients for a time period.",
    parameters: parameters,
    execute: async (args) => {
      const { period, year, quarter, month } = parameters.parse(args);
      const { start, end } = resolvePeriodRange({
        period,
        year,
        quarter,
        month,
      });
      const [summary, topClients] = await Promise.all([
        getRevenue(orgId, start, end),
        getRevenueByClient(orgId, start, end),
      ]);

      return {
        total: summary.total,
        invoiceCount: summary.count,
        avgInvoice: summary.count > 0 ? summary.total / summary.count : 0,
        topClients: topClients.map((client) => ({
          name: client.displayName,
          total: client.total,
        })),
      };
    },
  });
}
