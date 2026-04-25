import { and, eq } from "drizzle-orm";
import { z } from "zod";
import {
  contacts,
  invoices,
  invoiceItems,
  invoiceSequences,
} from "@opentab/db/schema";
import { db } from "@/lib/db";
import { formatInvoiceNumber } from "@/lib/invoicing/numbering";
import {
  calculateInvoiceTotals,
  calculateLineTotal,
} from "@/lib/invoicing/calculations";

const draftInvoiceItemSchema = z.object({
  productId: z.string().uuid().optional().or(z.literal("")),
  sortOrder: z.coerce.number().int().min(0).default(0),
  name: z.string().min(1).max(255),
  description: z.string().optional().default(""),
  quantity: z.string().regex(/^\d+(\.\d{1,4})?$/),
  unitPrice: z.string().regex(/^\d+(\.\d{1,2})?$/),
  unit: z.string().max(50).optional().default(""),
  taxCategory: z.string().max(50).default("standard"),
  taxRate: z.string().regex(/^\d+(\.\d{1,2})?$/),
});

export const createDraftInvoiceInputSchema = z.object({
  contactId: z.string().uuid(),
  issueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  dueDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .or(z.literal("")),
  currencyCode: z.string().length(3).default("EUR"),
  usesInclusiveTax: z.coerce.boolean().default(false),
  notes: z.string().optional().default(""),
  terms: z.string().optional().default(""),
  internalNotes: z.string().optional().default(""),
  items: z.array(draftInvoiceItemSchema).min(1),
});

export type CreateDraftInvoiceInput = z.infer<
  typeof createDraftInvoiceInputSchema
>;

function addDays(dateString: string, days: number) {
  const date = new Date(dateString);
  date.setDate(date.getDate() + days);
  return date.toISOString().split("T")[0];
}

function formatContactAddress(contact: {
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  postalCode: string | null;
}) {
  return [
    contact.addressLine1,
    contact.addressLine2,
    contact.city,
    contact.postalCode,
  ]
    .filter(Boolean)
    .join(", ");
}

async function getOrCreateSequence(orgId: string, type: string) {
  const [existing] = await db
    .select()
    .from(invoiceSequences)
    .where(
      and(eq(invoiceSequences.orgId, orgId), eq(invoiceSequences.type, type)),
    );

  if (existing) {
    return existing;
  }

  const [created] = await db
    .insert(invoiceSequences)
    .values({
      orgId,
      type,
      prefix: type === "quote" ? "QTE-" : "INV-",
    })
    .returning();

  return created;
}

async function generateNextInvoiceNumber(orgId: string) {
  await getOrCreateSequence(orgId, "invoice");

  return db.transaction(async (tx) => {
    const [sequence] = await tx
      .select()
      .from(invoiceSequences)
      .where(
        and(
          eq(invoiceSequences.orgId, orgId),
          eq(invoiceSequences.type, "invoice"),
        ),
      )
      .for("update");

    const invoiceNumber = formatInvoiceNumber({
      prefix: sequence.prefix,
      nextNumber: sequence.nextNumber,
      digitCount: sequence.digitCount,
      includeYear: sequence.includeYear,
      pattern: sequence.pattern,
    });

    await tx
      .update(invoiceSequences)
      .set({ nextNumber: sequence.nextNumber + 1 })
      .where(eq(invoiceSequences.id, sequence.id));

    return invoiceNumber;
  });
}

export async function createDraftInvoice(
  orgId: string,
  input: CreateDraftInvoiceInput,
) {
  const data = createDraftInvoiceInputSchema.parse(input);
  const [contact] = await db
    .select()
    .from(contacts)
    .where(and(eq(contacts.id, data.contactId), eq(contacts.orgId, orgId)))
    .limit(1);

  if (!contact) {
    throw new Error("Contact not found");
  }

  const dueDate =
    data.dueDate ||
    (contact.defaultPaymentTerms
      ? addDays(data.issueDate, contact.defaultPaymentTerms)
      : "");

  const totals = calculateInvoiceTotals(
    data.items.map((item) => ({
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      taxRate: item.taxRate,
    })),
    data.usesInclusiveTax,
  );

  const invoiceNumber = await generateNextInvoiceNumber(orgId);
  const [invoice] = await db
    .insert(invoices)
    .values({
      orgId,
      contactId: contact.id,
      invoiceNumber,
      issueDate: data.issueDate,
      dueDate: dueDate || null,
      currencyCode: data.currencyCode || contact.defaultCurrency || "EUR",
      usesInclusiveTax: data.usesInclusiveTax,
      subtotal: totals.subtotal,
      taxAmount: totals.taxAmount,
      total: totals.total,
      balance: totals.total,
      contactName: contact.displayName,
      contactEmail: contact.email || null,
      contactVatNumber: contact.vatNumber || null,
      contactAddress: formatContactAddress(contact) || null,
      notes: data.notes || null,
      terms: data.terms || null,
      internalNotes: data.internalNotes || null,
    })
    .returning();

  for (const item of data.items) {
    const lineTotals = calculateLineTotal({
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      taxRate: item.taxRate,
      usesInclusiveTax: data.usesInclusiveTax,
    });

    await db.insert(invoiceItems).values({
      invoiceId: invoice.id,
      productId: item.productId || null,
      sortOrder: item.sortOrder,
      name: item.name,
      description: item.description || null,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      unit: item.unit || null,
      taxCategory: item.taxCategory,
      taxRate: item.taxRate,
      taxAmount: lineTotals.taxAmount,
      lineTotal: lineTotals.lineTotal,
    });
  }

  return { invoice };
}
