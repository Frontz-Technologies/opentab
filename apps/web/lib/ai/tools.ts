import type { SessionContext } from "@/lib/session";
import type { ConfirmToolCall } from "@/lib/ai/types";
import { createGetRevenueSummaryTool } from "@/lib/ai/tools/get-revenue-summary";
import { createGetExpenseSummaryTool } from "@/lib/ai/tools/get-expense-summary";
import { createGetVatSummaryTool } from "@/lib/ai/tools/get-vat-summary";
import { createGetOutstandingInvoicesTool } from "@/lib/ai/tools/get-outstanding-invoices";
import { createCreateDraftInvoiceTool } from "@/lib/ai/tools/create-draft-invoice";
import { createCreateDraftExpenseTool } from "@/lib/ai/tools/create-draft-expense";
import { getCountryProvider } from "@/lib/country";
import type { AiTool } from "@/lib/country/types";

type CreateToolsOptions = {
  role: SessionContext["role"];
  confirmToolCall?: ConfirmToolCall;
  countryCode?: string | null;
};

function wrapCountryTool(tool: AiTool, orgId: string) {
  return {
    description: tool.description,
    inputSchema: tool.inputSchema,
    execute: async (input: unknown) => tool.handler(input, { orgId }),
  };
}

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

  const base =
    _options.role === "accountant"
      ? { ...readTools }
      : {
          ...readTools,
          createDraftInvoice: createCreateDraftInvoiceTool(
            orgId,
            _options.confirmToolCall,
          ),
          createDraftExpense: createCreateDraftExpenseTool(
            orgId,
            _options.confirmToolCall,
          ),
        };

  const provider = getCountryProvider(_options.countryCode ?? null);
  const countryTools: Record<string, unknown> = {};
  for (const tool of provider.aiTools ?? []) {
    countryTools[tool.name] = wrapCountryTool(tool, orgId);
  }
  for (const integration of provider.integrations) {
    for (const tool of integration.aiTools ?? []) {
      countryTools[tool.name] = wrapCountryTool(tool, orgId);
    }
  }

  return { ...base, ...countryTools } as typeof base;
}
