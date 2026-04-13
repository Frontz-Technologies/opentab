import type { SessionContext } from "@/lib/session";
import type { ConfirmToolCall } from "@/lib/ai/types";
import { createGetRevenueSummaryTool } from "@/lib/ai/tools/get-revenue-summary";
import { createGetExpenseSummaryTool } from "@/lib/ai/tools/get-expense-summary";
import { createGetVatSummaryTool } from "@/lib/ai/tools/get-vat-summary";
import { createGetOutstandingInvoicesTool } from "@/lib/ai/tools/get-outstanding-invoices";

type CreateToolsOptions = {
  role: SessionContext["role"];
  confirmToolCall?: ConfirmToolCall;
};

export function createTools(
  orgId: string,
  _options: CreateToolsOptions = { role: "owner" },
) {
  const readTools = {
    getRevenueSummary: createGetRevenueSummaryTool(orgId),
    getExpenseSummary: createGetExpenseSummaryTool(orgId),
    getVatSummary: createGetVatSummaryTool(orgId),
    getOutstandingInvoices: createGetOutstandingInvoicesTool(orgId),
  };

  return readTools;
}
