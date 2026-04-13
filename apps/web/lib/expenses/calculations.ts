// Re-export from invoicing — expense line item math is identical
export {
  calculateLineTotal,
  calculateInvoiceTotals as calculateExpenseTotals,
  type LineItemInput,
  type LineTotalResult,
  type InvoiceTotalsResult as ExpenseTotalsResult,
} from "@/lib/invoicing/calculations";
