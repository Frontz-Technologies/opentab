import { z } from "zod";
import type { ImporterDescriptor } from "../core/types";

// Credit notes mirror the invoice importer with two additions:
// - `reason` (required, enum from CREDIT_NOTE_REASON)
// - `parentInvoiceNumber` (optional back-ref; engine looks up the
//   parent at commit-time and links if found, never auto-creates)
//
// creditNoteNumber is optional from v1.1 — empty number → imports as
// DRAFT, opentab assigns the number on first publish.
export const creditNoteRowSchema = z.object({
  creditNoteNumber: z
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
  total: z.string().regex(/^\d+(\.\d{1,2})?$/),
  currencyCode: z.string().length(3).default("EUR"),
  reason: z.enum(["return", "correction", "discount", "other"]),
  reasonNote: z
    .string()
    .optional()
    .or(z.literal(""))
    .transform((v) => v || undefined),
  parentInvoiceNumber: z
    .string()
    .optional()
    .or(z.literal(""))
    .transform((v) => v || undefined),
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

type CreditNoteRow = z.infer<typeof creditNoteRowSchema>;

export const creditNotesImporter: ImporterDescriptor<CreditNoteRow> = {
  entityKey: "credit-notes",
  label: "Credit Notes",
  fields: [
    { name: "creditNoteNumber", required: false, type: "string" },
    { name: "issueDate", required: true, type: "date" },
    { name: "contactName", required: true, type: "string" },
    { name: "contactVatNumber", required: false, type: "string" },
    { name: "total", required: true, type: "string" },
    { name: "currencyCode", required: false, type: "string" },
    {
      name: "reason",
      required: true,
      type: "enum",
      enum: ["return", "correction", "discount", "other"],
    },
    { name: "reasonNote", required: false, type: "string" },
    { name: "parentInvoiceNumber", required: false, type: "string" },
    { name: "itemName", required: true, type: "string" },
    { name: "quantity", required: true, type: "string" },
    { name: "unitPrice", required: true, type: "string" },
    { name: "taxRate", required: true, type: "string" },
    { name: "unit", required: false, type: "string" },
  ],
  aliases: {
    creditNoteNumber: [
      "credit note number",
      "credit_note_number",
      "cn number",
      "number",
      "ref",
    ],
    issueDate: ["date", "issue date", "issue_date", "credit note date"],
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
    reason: ["reason"],
    reasonNote: ["reason note", "reason_note", "explanation"],
    parentInvoiceNumber: [
      "parent invoice",
      "parent_invoice_number",
      "credits invoice",
      "original invoice",
    ],
    itemName: ["item", "item name", "description", "line item"],
    quantity: ["qty", "quantity"],
    unitPrice: ["unit price", "unit_price", "rate", "price"],
    taxRate: ["tax rate", "vat rate", "tax %", "vat %"],
    unit: ["unit", "uom"],
  },
  rowSchema: creditNoteRowSchema,
  idempotencyKeyParts: (row, orgId) =>
    row.creditNoteNumber
      ? [orgId, "num", row.creditNoteNumber.toLowerCase()]
      : // Empty-number fallback: contact+date+total fingerprint.
        // "nonum" tag prevents collision with "num" keys.
        [
          orgId,
          "nonum",
          row.contactName.toLowerCase(),
          row.issueDate,
          row.total,
        ],
};

// Same multi-row grouping as invoices: rows that share the same
// creditNoteNumber across the CSV become one credit note with
// multiple line items. Empty-number rows can't be grouped — each
// becomes its own single-line credit note.
export function groupRowsByCreditNote(
  rows: CreditNoteRow[],
): { header: CreditNoteRow; lines: CreditNoteRow[] }[] {
  const map = new Map<
    string,
    { header: CreditNoteRow; lines: CreditNoteRow[] }
  >();
  let nonumCounter = 0;
  for (const row of rows) {
    if (!row.creditNoteNumber) {
      const key = `__nonum__${nonumCounter++}`;
      map.set(key, { header: row, lines: [row] });
      continue;
    }
    const key = row.creditNoteNumber;
    let entry = map.get(key);
    if (!entry) {
      entry = { header: row, lines: [] };
      map.set(key, entry);
    }
    entry.lines.push(row);
  }
  return Array.from(map.values());
}
