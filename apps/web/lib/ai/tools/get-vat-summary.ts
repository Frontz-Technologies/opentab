import { defineTool } from "./define-tool";
import { z } from "zod";
import { getInputVat, getOutputVat } from "@/lib/reports/queries";
import { resolvePeriodRange } from "./shared";

export function createGetVatSummaryTool(orgId: string) {
  const parameters = z.object({
    period: z.enum(["month", "quarter", "year"]),
    year: z.number().int().optional(),
    quarter: z.number().int().min(1).max(4).optional(),
    month: z.number().int().min(1).max(12).optional(),
  });

  return defineTool({
    description:
      "Get output VAT, input VAT, and net VAT payable for a time period.",
    parameters: parameters,
    execute: async (args) => {
      const { period, year, quarter, month } = parameters.parse(args);
      const { start, end } = resolvePeriodRange({
        period,
        year,
        quarter,
        month,
      });
      const [outputVatRows, inputVatRows] = await Promise.all([
        getOutputVat(orgId, start, end),
        getInputVat(orgId, start, end),
      ]);

      const outputVat = outputVatRows.reduce(
        (sum, row) => sum + row.vatAmount,
        0,
      );
      const inputVat = inputVatRows.reduce(
        (sum, row) => sum + row.vatAmount,
        0,
      );

      return {
        outputVat,
        inputVat,
        netPayable: outputVat - inputVat,
        byRate: outputVatRows.map((row) => {
          const input = inputVatRows.find(
            (inputRow) => inputRow.rate === row.rate,
          );
          return {
            rate: row.rate,
            output: row.vatAmount,
            input: input?.vatAmount ?? 0,
          };
        }),
      };
    },
  });
}
