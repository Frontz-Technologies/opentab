import { and, eq } from "drizzle-orm";
import { z } from "zod";
import {
  contacts,
  expenses,
  expenseItems,
  invoiceSequences,
  organisations,
} from "@opentab/db/schema";
import { db } from "@/lib/db";
import { formatInvoiceNumber } from "@/lib/invoicing/numbering";
import {
  calculateInvoiceTotals,
  calculateLineTotal,
} from "@/lib/invoicing/calculations";
import { getFxRate } from "@/lib/fx/get-rate";
import {
  isSupportedCurrency,
  type SupportedCurrencyCode,
} from "@/lib/currency/supported";
import { assertExpenseCategoryInOrg } from "@/lib/security/assert-same-org";
import { createExpenseSchema } from "@/lib/entities/expense";

const draftExpenseItemSchema = z.object({
  sortOrder: z.coerce.number().int().min(0).default(0),
  name: z.string().min(1).max(255),
  description: z.string().optional().default(""),
  quantity: z.string().regex(/^\d+(\.\d{1,4})?$/),
  unitPrice: z.string().regex(/^\d+(\.\d{1,2})?$/),
  taxRate: z.string().regex(/^\d+(\.\d{1,2})?$/),
});

// Derived from the action-layer `createExpenseSchema` so a future field
// added there can't silently get stripped by this helper's `.parse()`.
// Two fields are deliberately overridden:
// - `categoryId`: optional here. Form callers pass it through the action
//   schema (which requires it); non-form callers like the AI tool may
//   omit it for early drafts.
// - `items`: uses `draftExpenseItemSchema`, which defaults `sortOrder` to
//   0 instead of requiring it (the form supplies sortOrder explicitly).
export const createDraftExpenseInputSchema = createExpenseSchema.extend({
  categoryId: z.string().uuid().optional().or(z.literal("")),
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
      .where(
        and(
          eq(invoiceSequences.id, sequence.id),
          eq(invoiceSequences.orgId, orgId),
        ),
      );

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

  // #274 carry-over: validate categoryId belongs to the session org
  // BEFORE the insert. Contact is already same-org-scoped above, so
  // its FK is verified by the SELECT pattern. The schema accepts any
  // UUID for categoryId — without this check a cross-org id would
  // hit the FK constraint at write time (which throws an opaque DB
  // error and leaves no audit trail) or, worse, silently succeed if
  // the row exists.
  if (data.categoryId) {
    await assertExpenseCategoryInOrg(db, data.categoryId, orgId);
  }

  const totals = calculateInvoiceTotals(
    data.items.map((item) => ({
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      taxRate: item.taxRate,
    })),
    data.usesInclusiveTax,
  );

  const resolvedCurrency =
    data.currencyCode || contact?.defaultCurrency || "EUR";

  // Snapshot the FX rate at save time so historical reports stay
  // stable even if ECB later revises a published rate. When the
  // expense currency matches the org default currency, getFxRate's
  // identity branch returns 1 — kept explicit so the fallthrough is
  // obvious to future readers.
  const [org] = await db
    .select({ defaultCurrency: organisations.defaultCurrency })
    .from(organisations)
    .where(eq(organisations.id, orgId))
    .limit(1);
  const orgDefaultCurrency = org?.defaultCurrency ?? "EUR";

  let exchangeRate = "1.000000";
  if (
    isSupportedCurrency(resolvedCurrency) &&
    isSupportedCurrency(orgDefaultCurrency)
  ) {
    const fx = await getFxRate(
      new Date(`${data.expenseDate}T00:00:00Z`),
      resolvedCurrency as SupportedCurrencyCode,
      orgDefaultCurrency as SupportedCurrencyCode,
    );
    exchangeRate = fx.rate.toFixed(6);
  }

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
      currencyCode: resolvedCurrency,
      exchangeRate,
      usesInclusiveTax: data.usesInclusiveTax,
      subtotal: totals.subtotal,
      taxAmount: totals.taxAmount,
      total: totals.total,
      supplierInvoiceNumber: data.supplierInvoiceNumber || null,
      // Empty string is treated as "fall through to contact lookup",
      // not "force NULL". Callers that want to clear a contact-derived
      // name explicitly should pass " " or call updateExpense.
      contactName: data.contactName || contact?.displayName || null,
      contactVatNumber: data.contactVatNumber || contact?.vatNumber || null,
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
