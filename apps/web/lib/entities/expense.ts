import { z } from "zod";
import { expenses, expenseItems } from "@opentab/db/schema";

export { expenses, expenseItems };

export const expenseLineItemSchema = z.object({
  sortOrder: z.coerce.number().int().min(0),
  name: z.string().min(1).max(255),
  description: z.string().optional().default(""),
  quantity: z.string().regex(/^\d+(\.\d{1,4})?$/),
  unitPrice: z.string().regex(/^\d+(\.\d{1,2})?$/),
  taxRate: z.string().regex(/^\d+(\.\d{1,2})?$/),
});

export const createExpenseSchema = z.object({
  contactId: z.string().uuid().optional().or(z.literal("")),
  categoryId: z.string().uuid().optional().or(z.literal("")),
  expenseDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  paymentDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .or(z.literal("")),
  currencyCode: z.string().length(3).default("EUR"),
  usesInclusiveTax: z.coerce.boolean().default(false),
  supplierInvoiceNumber: z.string().max(100).optional().default(""),
  contactName: z.string().max(255).optional().default(""),
  contactVatNumber: z.string().max(50).optional().default(""),
  description: z.string().optional().default(""),
  notes: z.string().optional().default(""),
  items: z
    .array(expenseLineItemSchema)
    .min(1, "At least one line item is required"),
});

export const updateExpenseSchema = createExpenseSchema;

export type ExpenseLineItemInput = z.infer<typeof expenseLineItemSchema>;
export type ExpenseCreateInput = z.infer<typeof createExpenseSchema>;
export type ExpenseUpdateInput = z.infer<typeof updateExpenseSchema>;
