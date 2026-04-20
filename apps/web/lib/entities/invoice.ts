import { z } from "zod";
import { invoices, invoiceItems, INVOICE_STATUS } from "@opentab/db/schema";

export { invoices, invoiceItems, INVOICE_STATUS };

export const invoiceLineItemSchema = z.object({
  productId: z.string().uuid().optional().or(z.literal("")),
  sortOrder: z.coerce.number().int().min(0),
  name: z.string().min(1).max(255),
  description: z.string().optional().default(""),
  quantity: z.string().regex(/^\d+(\.\d{1,4})?$/),
  unitPrice: z.string().regex(/^\d+(\.\d{1,2})?$/),
  unit: z.string().max(50).optional().default(""),
  taxCategory: z.string().max(50).default("standard"),
  taxRate: z.string().regex(/^\d+(\.\d{1,2})?$/),
});

export const createInvoiceSchema = z.object({
  contactId: z.string().uuid(),
  issueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  dueDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .or(z.literal("")),
  currencyCode: z.string().length(3).default("EUR"),
  usesInclusiveTax: z.coerce.boolean().default(false),
  contactName: z.string().min(1).max(255),
  contactEmail: z.string().email().optional().or(z.literal("")),
  contactVatNumber: z.string().max(50).optional().default(""),
  contactAddress: z.string().optional().default(""),
  notes: z.string().optional().default(""),
  terms: z.string().optional().default(""),
  internalNotes: z.string().optional().default(""),
  items: z
    .array(invoiceLineItemSchema)
    .min(1, "At least one line item is required"),
});

export const updateInvoiceSchema = createInvoiceSchema;

export type InvoiceLineItemInput = z.infer<typeof invoiceLineItemSchema>;
export type InvoiceCreateInput = z.infer<typeof createInvoiceSchema>;
export type InvoiceUpdateInput = z.infer<typeof updateInvoiceSchema>;
