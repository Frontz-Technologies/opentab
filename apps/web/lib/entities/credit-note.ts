import { z } from "zod";
import {
  moneyString,
  quantityString,
  taxRateString,
} from "@/lib/validation/money";
import {
  creditNotes,
  creditNoteItems,
  CREDIT_NOTE_STATUS,
  CREDIT_NOTE_REASON,
} from "@opentab/db/schema";

export { creditNotes, creditNoteItems, CREDIT_NOTE_STATUS, CREDIT_NOTE_REASON };
export type {
  CreditNote,
  NewCreditNote,
  CreditNoteItem,
  NewCreditNoteItem,
} from "@opentab/db/schema";

export const creditNoteLineItemSchema = z.object({
  productId: z.string().uuid().optional().or(z.literal("")),
  sortOrder: z.coerce.number().int().min(0),
  name: z.string().min(1).max(255),
  description: z.string().optional().default(""),
  quantity: quantityString,
  unitPrice: moneyString,
  unit: z.string().max(50).optional().default(""),
  taxCategory: z.string().max(50).default("standard"),
  taxRate: taxRateString,
});

export const createCreditNoteSchema = z.object({
  contactId: z.string().uuid(),
  invoiceId: z.string().uuid().optional().or(z.literal("")),
  issueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  currencyCode: z.string().length(3).default("EUR"),
  usesInclusiveTax: z.coerce.boolean().default(false),
  contactName: z.string().min(1).max(255),
  contactEmail: z.string().email().optional().or(z.literal("")),
  contactVatNumber: z.string().max(50).optional().default(""),
  contactAddress: z.string().optional().default(""),
  reason: z.enum([
    CREDIT_NOTE_REASON.RETURN,
    CREDIT_NOTE_REASON.CORRECTION,
    CREDIT_NOTE_REASON.DISCOUNT,
    CREDIT_NOTE_REASON.OTHER,
  ]),
  reasonNote: z.string().optional().default(""),
  notes: z.string().optional().default(""),
  terms: z.string().optional().default(""),
  items: z
    .array(creditNoteLineItemSchema)
    .min(1, "At least one line item is required"),
});

export const updateCreditNoteSchema = createCreditNoteSchema;
