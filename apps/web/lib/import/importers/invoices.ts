import { z } from "zod";
import type { ImporterDescriptor } from "../core/types";

// invoiceNumber is REQUIRED in v1 — v1.1 will let the field be empty
// to mean "treat as draft, defer numbering" now that #132's nullable
// migration covers existing rows.
export const invoiceRowSchema = z.object({
  invoiceNumber: z.string().min(1),
  issueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  contactName: z.string().min(1),
  contactVatNumber: z
    .string()
    .optional()
    .or(z.literal(""))
    .transform((v) => v || undefined),
  total: z.string().regex(/^\d+(\.\d{1,2})?$/),
  currencyCode: z.string().length(3).default("EUR"),
  dueDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  itemName: z.string().min(1),
  quantity: z.string().regex(/^\d+(\.\d{1,4})?$/),
  unitPrice: z.string().regex(/^\d+(\.\d{1,2})?$/),
  taxRate: z.string().regex(/^\d+(\.\d{1,2})?$/),
  unit: z
    .string()
    .optional()
    .or(z.literal(""))
    .transform((v) => v || undefined),
});

type InvoiceRow = z.infer<typeof invoiceRowSchema>;

export const invoicesImporter: ImporterDescriptor<InvoiceRow> = {
  entityKey: "invoices",
  label: "Invoices",
  fields: [
    { name: "invoiceNumber", required: true, type: "string" },
    { name: "issueDate", required: true, type: "date" },
    { name: "contactName", required: true, type: "string" },
    { name: "contactVatNumber", required: false, type: "string" },
    { name: "total", required: true, type: "string" },
    { name: "currencyCode", required: false, type: "string" },
    { name: "dueDate", required: false, type: "date" },
    { name: "itemName", required: true, type: "string" },
    { name: "quantity", required: true, type: "string" },
    { name: "unitPrice", required: true, type: "string" },
    { name: "taxRate", required: true, type: "string" },
    { name: "unit", required: false, type: "string" },
  ],
  aliases: {
    invoiceNumber: ["invoice number", "invoice_number", "number", "no", "ref"],
    issueDate: ["date", "issue date", "issue_date", "invoice date"],
    contactName: [
      "customer",
      "client",
      "contact",
      "client name",
      "customer name",
    ],
    contactVatNumber: ["vat", "client vat", "customer vat", "afm"],
    total: ["total", "amount", "gross"],
    currencyCode: ["currency", "ccy"],
    dueDate: ["due date", "due_date", "due"],
    itemName: ["item", "item name", "description", "line item"],
    quantity: ["qty", "quantity"],
    unitPrice: ["unit price", "unit_price", "rate", "price"],
    taxRate: ["tax rate", "vat rate", "tax %", "vat %"],
    unit: ["unit", "uom"],
  },
  rowSchema: invoiceRowSchema,
  idempotencyKeyParts: (row, orgId) => [orgId, row.invoiceNumber.toLowerCase()],
};

// Multi-row grouping: rows that share the same invoiceNumber across
// the CSV become a single invoice with multiple line items (Project A
// pattern adapted to single-CSV). The invoice header is taken from
// the first row in the group; subsequent rows contribute their line
// item only.
export function groupRowsByInvoice(
  rows: InvoiceRow[],
): { header: InvoiceRow; lines: InvoiceRow[] }[] {
  const map = new Map<string, { header: InvoiceRow; lines: InvoiceRow[] }>();
  for (const row of rows) {
    const key = row.invoiceNumber;
    let entry = map.get(key);
    if (!entry) {
      entry = { header: row, lines: [] };
      map.set(key, entry);
    }
    entry.lines.push(row);
  }
  return Array.from(map.values());
}
