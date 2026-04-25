import { z } from "zod";
import type { ImporterDescriptor } from "../core/types";

// `expenseNumber` is notNull at the DB level (verified during the
// spec audit). When the user's CSV doesn't supply one, the action
// auto-generates `IMPORT-<timestamp>-<rand>` per the existing demo-
// seed pattern; schema below permits it to be optional.
export const expenseRowSchema = z.object({
  expenseDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  total: z.string().regex(/^\d+(\.\d{1,2})?$/),
  subtotal: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/)
    .optional(),
  taxAmount: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/)
    .optional(),
  supplierName: z
    .string()
    .optional()
    .or(z.literal(""))
    .transform((v) => v || undefined),
  supplierVat: z
    .string()
    .optional()
    .or(z.literal(""))
    .transform((v) => v || undefined),
  categoryName: z
    .string()
    .optional()
    .or(z.literal(""))
    .transform((v) => v || undefined),
  categoryCode: z
    .string()
    .optional()
    .or(z.literal(""))
    .transform((v) => v || undefined),
  currencyCode: z.string().length(3).default("EUR"),
  paymentDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  expenseNumber: z
    .string()
    .optional()
    .or(z.literal(""))
    .transform((v) => v || undefined),
  notes: z
    .string()
    .optional()
    .or(z.literal(""))
    .transform((v) => v || undefined),
});

type ExpenseRow = z.infer<typeof expenseRowSchema>;

export const expensesImporter: ImporterDescriptor<ExpenseRow> = {
  entityKey: "expenses",
  label: "Expenses",
  fields: [
    { name: "expenseDate", required: true, type: "date" },
    { name: "total", required: true, type: "string" },
    { name: "subtotal", required: false, type: "string" },
    { name: "taxAmount", required: false, type: "string" },
    { name: "supplierName", required: false, type: "string" },
    { name: "supplierVat", required: false, type: "string" },
    { name: "categoryName", required: false, type: "string" },
    { name: "categoryCode", required: false, type: "string" },
    { name: "currencyCode", required: false, type: "string" },
    { name: "paymentDate", required: false, type: "date" },
    { name: "expenseNumber", required: false, type: "string" },
    { name: "notes", required: false, type: "string" },
  ],
  aliases: {
    expenseDate: ["date", "expense date", "expense_date", "issue date"],
    total: ["total", "amount", "total amount", "gross"],
    subtotal: ["subtotal", "net", "net amount"],
    taxAmount: ["tax", "tax amount", "vat amount", "vat"],
    supplierName: ["supplier", "vendor", "supplier name", "vendor name"],
    supplierVat: [
      "supplier vat",
      "vendor vat",
      "vendor tax id",
      "supplier afm",
    ],
    categoryName: ["category", "category name", "expense category"],
    categoryCode: ["category code", "category_code"],
    currencyCode: ["currency", "currency code", "currency_code", "ccy"],
    paymentDate: ["payment date", "paid date", "paid on"],
    expenseNumber: [
      "number",
      "expense number",
      "ref",
      "reference",
      "invoice number",
    ],
    notes: ["notes", "memo", "description"],
  },
  rowSchema: expenseRowSchema,
  idempotencyKeyParts: (row, orgId) => [
    orgId,
    row.expenseDate,
    row.total,
    (row.supplierName ?? row.supplierVat ?? "").toLowerCase(),
    row.expenseNumber ?? "",
  ],
};
