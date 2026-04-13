import { tool, zodSchema } from "ai";
import { z } from "zod";
import { getOutstanding } from "@/lib/reports/queries";

export function createGetOutstandingInvoicesTool(orgId: string) {
  const parameters = z.object({
    daysOverdue: z.number().int().min(0).optional(),
  });

  return tool({
    description: "Get outstanding invoice totals and overdue counts.",
    parameters: zodSchema(parameters),
    execute: async (args) => {
      parameters.parse(args);
      const outstanding = await getOutstanding(orgId);

      return {
        invoices: [],
        totalOutstanding: outstanding.total,
        overdueOutstanding: outstanding.overdueTotal,
        count: outstanding.count,
        overdueCount: outstanding.overdueCount,
      };
    },
  });
}
