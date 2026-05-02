import { z } from "zod";
import type { ImporterDescriptor } from "../core/types";
import {
  moneyString,
  quantityString,
  taxRateString,
} from "@/lib/validation/money";

// invoiceNumber is optional from v1.1 onward. Empty number → invoice
// imports as DRAFT, opentab assigns the number on first publish using
// the deferred-numbering pattern. The idempotency-key fn falls back
// to a contact+date+total fingerprint for empty-number rows so
// re-importing the same CSV is still safe.
export const invoiceRowSchema = z.object({
  invoiceNumber: z
    .string()
    .optional()
    .or(z.literal(""))
    .transform((v) => v || undefined),
  issueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  contactName: z.string().min(1),
  contactVatNumber: z
    .string()
    .optional()
    .or(z.literal(""))
    .transform((v) => v || undefined),
  total: moneyString,
  currencyCode: z.string().length(3).default("EUR"),
  dueDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  itemName: z.string().min(1),
  quantity: quantityString,
  unitPrice: moneyString,
  taxRate: taxRateString,
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
    { name: "invoiceNumber", required: false, type: "string" },
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
  idempotencyKeyParts: (row, orgId) =>
    row.invoiceNumber
      ? [orgId, "num", row.invoiceNumber.toLowerCase()]
      : // Empty-number fallback: contact+date+total fingerprint.
        // Prefix with a tag ("nonum") so an empty-number row whose
        // fingerprint accidentally collides with a numbered row's
        // "num" key cannot dedup against it.
        [
          orgId,
          "nonum",
          row.contactName.toLowerCase(),
          row.issueDate,
          row.total,
        ],
};

// Multi-row grouping: rows that share the same invoiceNumber across
// the CSV become a single invoice with multiple line items (Project A
// pattern adapted to single-CSV). The invoice header is taken from
// the first row in the group; subsequent rows contribute their line
// item only.
//
// Empty-number rows can't be grouped (no shared key), so each one
// becomes its own single-line invoice. Index appended for uniqueness.
export function groupRowsByInvoice(
  rows: InvoiceRow[],
): { header: InvoiceRow; lines: InvoiceRow[] }[] {
  const map = new Map<string, { header: InvoiceRow; lines: InvoiceRow[] }>();
  let nonumCounter = 0;
  for (const row of rows) {
    if (!row.invoiceNumber) {
      const key = `__nonum__${nonumCounter++}`;
      map.set(key, { header: row, lines: [row] });
      continue;
    }
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
