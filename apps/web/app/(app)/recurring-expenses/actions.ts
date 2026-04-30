"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/session";
import {
  recurringExpenses,
  recurringExpenseItems,
  RECURRING_EXPENSE_STATUS,
} from "@opentab/db/schema";
import { eq, and } from "drizzle-orm";
import { db } from "@/lib/db";
import { z } from "zod";
import { calculateLineTotal } from "@/lib/invoicing/calculations";

const lineItemSchema = z.object({
  sortOrder: z.coerce.number().int().min(0),
  name: z.string().min(1).max(255),
  description: z.string().optional().default(""),
  quantity: z.string().regex(/^\d+(\.\d{1,4})?$/),
  unitPrice: z.string().regex(/^\d+(\.\d{1,2})?$/),
  taxRate: z.string().regex(/^\d+(\.\d{1,2})?$/),
});

const recurringExpenseSchema = z.object({
  contactId: z.string().uuid().optional().or(z.literal("")),
  categoryId: z.string().uuid().optional().or(z.literal("")),
  frequency: z.coerce.number().int().min(1).max(7),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .or(z.literal("")),
  nextRunDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  remainingCycles: z.coerce.number().int().min(0).optional(),
  autoConfirm: z.coerce.boolean().default(false),
  usesInclusiveTax: z.coerce.boolean().default(false),
  currencyCode: z.string().length(3).default("EUR"),
  description: z.string().optional().default(""),
  notes: z.string().optional().default(""),
  items: z.array(lineItemSchema).min(1),
});

export async function createRecurringExpense(formData: FormData) {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");

  let rawItems: unknown;
  try {
    rawItems = JSON.parse((formData.get("items") as string) ?? "[]");
  } catch {
    return { success: false, error: { items: ["Invalid line items data"] } };
  }

  const parsed = recurringExpenseSchema.safeParse({
    contactId: formData.get("contactId") ?? "",
    categoryId: formData.get("categoryId") ?? "",
    frequency: formData.get("frequency"),
    startDate: formData.get("startDate"),
    endDate: formData.get("endDate") ?? "",
    nextRunDate: formData.get("nextRunDate") || formData.get("startDate"),
    remainingCycles: formData.get("remainingCycles") || undefined,
    autoConfirm: formData.get("autoConfirm") === "true",
    usesInclusiveTax: formData.get("usesInclusiveTax") === "true",
    currencyCode: formData.get("currencyCode") ?? "EUR",
    description: formData.get("description") ?? "",
    notes: formData.get("notes") ?? "",
    items: rawItems,
  });

  if (!parsed.success) {
    return { success: false, error: parsed.error.flatten().fieldErrors };
  }

  const data = parsed.data;

  const [recurring] = await db
    .insert(recurringExpenses)
    .values({
      orgId: session.org.id,
      contactId: data.contactId || null,
      categoryId: data.categoryId || null,
      frequency: data.frequency,
      startDate: data.startDate,
      endDate: data.endDate || null,
      nextRunDate: data.nextRunDate,
      remainingCycles: data.remainingCycles ?? null,
      autoConfirm: data.autoConfirm,
      usesInclusiveTax: data.usesInclusiveTax,
      currencyCode: data.currencyCode,
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
    await db.insert(recurringExpenseItems).values({
      recurringExpenseId: recurring.id,
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

  revalidatePath("/recurring-expenses");
  return { success: true, recurring };
}

export async function updateRecurringExpense(id: string, formData: FormData) {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");

  // #274: pre-check that the recurring expense belongs to this org
  // BEFORE deleting its items. Without this guard, a cross-org id
  // would silently no-op the parent UPDATE (which is correctly
  // scoped) yet the subsequent
  // `delete(recurringExpenseItems).where(recurringExpenseId = id)`
  // would still wipe another org's line items, since
  // recurringExpenseItems has no orgId column. Mirror of the
  // updateInvoice / updateRecurring pre-check shape.
  const [existing] = await db
    .select()
    .from(recurringExpenses)
    .where(
      and(
        eq(recurringExpenses.id, id),
        eq(recurringExpenses.orgId, session.org.id),
      ),
    );
  if (!existing) {
    return { success: false, error: { _: ["Recurring expense not found"] } };
  }

  let rawItems: unknown;
  try {
    rawItems = JSON.parse((formData.get("items") as string) ?? "[]");
  } catch {
    return { success: false, error: { items: ["Invalid line items data"] } };
  }

  const parsed = recurringExpenseSchema.safeParse({
    contactId: formData.get("contactId") ?? "",
    categoryId: formData.get("categoryId") ?? "",
    frequency: formData.get("frequency"),
    startDate: formData.get("startDate"),
    endDate: formData.get("endDate") ?? "",
    nextRunDate: formData.get("nextRunDate") || formData.get("startDate"),
    remainingCycles: formData.get("remainingCycles") || undefined,
    autoConfirm: formData.get("autoConfirm") === "true",
    usesInclusiveTax: formData.get("usesInclusiveTax") === "true",
    currencyCode: formData.get("currencyCode") ?? "EUR",
    description: formData.get("description") ?? "",
    notes: formData.get("notes") ?? "",
    items: rawItems,
  });

  if (!parsed.success) {
    return { success: false, error: parsed.error.flatten().fieldErrors };
  }

  const data = parsed.data;

  await db
    .update(recurringExpenses)
    .set({
      contactId: data.contactId || null,
      categoryId: data.categoryId || null,
      frequency: data.frequency,
      startDate: data.startDate,
      endDate: data.endDate || null,
      nextRunDate: data.nextRunDate,
      remainingCycles: data.remainingCycles ?? null,
      autoConfirm: data.autoConfirm,
      usesInclusiveTax: data.usesInclusiveTax,
      currencyCode: data.currencyCode,
      description: data.description || null,
      notes: data.notes || null,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(recurringExpenses.id, id),
        eq(recurringExpenses.orgId, session.org.id),
      ),
    );

  await db
    .delete(recurringExpenseItems)
    .where(eq(recurringExpenseItems.recurringExpenseId, id));

  for (const item of data.items) {
    const lineTotals = calculateLineTotal({
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      taxRate: item.taxRate,
      usesInclusiveTax: data.usesInclusiveTax,
    });
    await db.insert(recurringExpenseItems).values({
      recurringExpenseId: id,
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

  revalidatePath("/recurring-expenses");
  revalidatePath(`/recurring-expenses/${id}`);
  return { success: true };
}

export async function pauseRecurringExpense(id: string) {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");

  await db
    .update(recurringExpenses)
    .set({
      status: RECURRING_EXPENSE_STATUS.PAUSED,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(recurringExpenses.id, id),
        eq(recurringExpenses.orgId, session.org.id),
      ),
    );

  revalidatePath("/recurring-expenses");
  revalidatePath(`/recurring-expenses/${id}`);
  return { success: true };
}

export async function resumeRecurringExpense(id: string) {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");

  await db
    .update(recurringExpenses)
    .set({
      status: RECURRING_EXPENSE_STATUS.ACTIVE,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(recurringExpenses.id, id),
        eq(recurringExpenses.orgId, session.org.id),
      ),
    );

  revalidatePath("/recurring-expenses");
  revalidatePath(`/recurring-expenses/${id}`);
  return { success: true };
}

export async function deleteRecurringExpense(id: string) {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");

  await db
    .delete(recurringExpenses)
    .where(
      and(
        eq(recurringExpenses.id, id),
        eq(recurringExpenses.orgId, session.org.id),
      ),
    );

  revalidatePath("/recurring-expenses");
  return { success: true };
}
