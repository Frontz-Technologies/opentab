import { and, eq } from "drizzle-orm";
import { z } from "zod";
import {
  contacts,
  expenses,
  expenseItems,
  invoiceSequences,
} from "@opentab/db/schema";
import { db } from "@/lib/db";
import { formatInvoiceNumber } from "@/lib/invoicing/numbering";
import {
  calculateInvoiceTotals,
  calculateLineTotal,
} from "@/lib/invoicing/calculations";

const draftExpenseItemSchema = z.object({
  sortOrder: z.coerce.number().int().min(0).default(0),
  name: z.string().min(1).max(255),
  description: z.string().optional().default(""),
  quantity: z.string().regex(/^\d+(\.\d{1,4})?$/),
  unitPrice: z.string().regex(/^\d+(\.\d{1,2})?$/),
  taxRate: z.string().regex(/^\d+(\.\d{1,2})?$/),
});

export const createDraftExpenseInputSchema = z.object({
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
  description: z.string().optional().default(""),
  notes: z.string().optional().default(""),
  items: z.array(draftExpenseItemSchema).min(1),
});

export type CreateDraftExpenseInput = z.infer<
  typeof createDraftExpenseInputSchema
>;

async function getOrCreateExpenseSequence(orgId: string) {
  const [existing] = await db
    .select()
    .from(invoiceSequences)
    .where(
      and(
        eq(invoiceSequences.orgId, orgId),
        eq(invoiceSequences.type, "expense"),
      ),
    );

  if (existing) {
    return existing;
  }

  const [created] = await db
    .insert(invoiceSequences)
    .values({
      orgId,
      type: "expense",
      prefix: "EXP-",
    })
    .returning();

  return created;
}

async function generateExpenseNumber(orgId: string) {
  await getOrCreateExpenseSequence(orgId);

  return db.transaction(async (tx) => {
    const [sequence] = await tx
      .select()
      .from(invoiceSequences)
      .where(
        and(
          eq(invoiceSequences.orgId, orgId),
          eq(invoiceSequences.type, "expense"),
        ),
      )
      .for("update");

    const expenseNumber = formatInvoiceNumber({
      prefix: sequence.prefix,
      nextNumber: sequence.nextNumber,
      digitCount: sequence.digitCount,
      includeYear: sequence.includeYear,
    });

    await tx
      .update(invoiceSequences)
      .set({ nextNumber: sequence.nextNumber + 1 })
      .where(eq(invoiceSequences.id, sequence.id));

    return expenseNumber;
  });
}

export async function createDraftExpense(
  orgId: string,
  input: CreateDraftExpenseInput,
) {
  const data = createDraftExpenseInputSchema.parse(input);
  const contactId = data.contactId || "";
  const [contact] = contactId
    ? await db
        .select()
        .from(contacts)
        .where(and(eq(contacts.id, contactId), eq(contacts.orgId, orgId)))
        .limit(1)
    : [];

  const totals = calculateInvoiceTotals(
    data.items.map((item) => ({
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      taxRate: item.taxRate,
    })),
    data.usesInclusiveTax,
  );

  const expenseNumber = await generateExpenseNumber(orgId);
  const [expense] = await db
    .insert(expenses)
    .values({
      orgId,
      contactId: contact?.id || null,
      categoryId: data.categoryId || null,
      expenseNumber,
      expenseDate: data.expenseDate,
      paymentDate: data.paymentDate || null,
      currencyCode: data.currencyCode || contact?.defaultCurrency || "EUR",
      usesInclusiveTax: data.usesInclusiveTax,
      subtotal: totals.subtotal,
      taxAmount: totals.taxAmount,
      total: totals.total,
      supplierInvoiceNumber: data.supplierInvoiceNumber || null,
      contactName: contact?.displayName || null,
      contactVatNumber: contact?.vatNumber || null,
      description: data.description || null,
      notes: data.notes || null,
    })
    .returning();

  for (const item of data.items) {
    const lineTotals = calculateLineTotal({
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      taxRate: item.taxRate,
      usesInclusiveTax: data.usesInclusiveTax,
    });

    await db.insert(expenseItems).values({
      expenseId: expense.id,
      sortOrder: item.sortOrder,
      name: item.name,
      description: item.description || null,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      taxRate: item.taxRate,
      taxAmount: lineTotals.taxAmount,
      lineTotal: lineTotals.lineTotal,
    });
  }

  return { expense };
}
