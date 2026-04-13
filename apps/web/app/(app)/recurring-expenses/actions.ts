"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/session";
import {
  recurringExpenses,
  recurringExpenseItems,
  RECURRING_EXPENSE_STATUS,
  EXPENSE_FREQUENCY,
} from "@opentab/db/schema";
import { eq, and } from "drizzle-orm";
import { db } from "@/lib/db";
import { z } from "zod";
import { calculateLineTotal } from "@/lib/expenses/calculations";

const recurringItemSchema = z.object({
  categoryId: z.string().uuid().optional().or(z.literal("")),
  sortOrder: z.coerce.number().int().min(0),
  name: z.string().min(1).max(255),
  description: z.string().optional().default(""),
  quantity: z.string().regex(/^\d+(\.\d{1,4})?$/),
  unitPrice: z.string().regex(/^\d+(\.\d{1,2})?$/),
  unit: z.string().max(50).optional().default(""),
  taxCategory: z.string().max(50).default("standard"),
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
  remainingCycles: z.coerce.number().int().min(0).optional(),
  autoConfirm: z.coerce.boolean().default(false),
  currencyCode: z.string().length(3).default("EUR"),
  usesInclusiveTax: z.coerce.boolean().default(false),
  description: z.string().optional().default(""),
  notes: z.string().optional().default(""),
  items: z
    .array(recurringItemSchema)
    .min(1, "At least one line item is required"),
});

export async function createRecurringExpense(formData: FormData) {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");

  const rawItems = JSON.parse(formData.get("items") as string);

  const parsed = recurringExpenseSchema.safeParse({
    contactId: formData.get("contactId") || undefined,
    categoryId: formData.get("categoryId") || undefined,
    frequency: formData.get("frequency"),
    startDate: formData.get("startDate"),
    endDate: formData.get("endDate") || undefined,
    remainingCycles: formData.get("remainingCycles") || undefined,
    autoConfirm: formData.get("autoConfirm") === "true",
    currencyCode: formData.get("currencyCode") ?? "EUR",
    usesInclusiveTax: formData.get("usesInclusiveTax") === "true",
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
      nextRunDate: data.startDate,
      remainingCycles: data.remainingCycles ?? null,
      autoConfirm: data.autoConfirm,
      currencyCode: data.currencyCode,
      usesInclusiveTax: data.usesInclusiveTax,
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
      categoryId: item.categoryId || null,
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

  revalidatePath("/recurring-expenses");
  return { success: true, recurring };
}

export async function updateRecurringExpense(id: string, formData: FormData) {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");

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

  const rawItems = JSON.parse(formData.get("items") as string);

  const parsed = recurringExpenseSchema.safeParse({
    contactId: formData.get("contactId") || undefined,
    categoryId: formData.get("categoryId") || undefined,
    frequency: formData.get("frequency"),
    startDate: formData.get("startDate"),
    endDate: formData.get("endDate") || undefined,
    remainingCycles: formData.get("remainingCycles") || undefined,
    autoConfirm: formData.get("autoConfirm") === "true",
    currencyCode: formData.get("currencyCode") ?? "EUR",
    usesInclusiveTax: formData.get("usesInclusiveTax") === "true",
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
      remainingCycles: data.remainingCycles ?? null,
      autoConfirm: data.autoConfirm,
      currencyCode: data.currencyCode,
      usesInclusiveTax: data.usesInclusiveTax,
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

  // Replace line items
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
      categoryId: item.categoryId || null,
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

  revalidatePath("/recurring-expenses");
  revalidatePath(`/recurring-expenses/${id}`);
  return { success: true };
}

export async function pauseRecurringExpense(id: string) {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");

  const [existing] = await db
    .select()
    .from(recurringExpenses)
    .where(
      and(
        eq(recurringExpenses.id, id),
        eq(recurringExpenses.orgId, session.org.id),
      ),
    );

  if (!existing)
    return { success: false, error: "Recurring expense not found" };
  if (existing.status !== RECURRING_EXPENSE_STATUS.ACTIVE) {
    return {
      success: false,
      error: "Only active recurring expenses can be paused",
    };
  }

  await db
    .update(recurringExpenses)
    .set({ status: RECURRING_EXPENSE_STATUS.PAUSED, updatedAt: new Date() })
    .where(eq(recurringExpenses.id, id));

  revalidatePath("/recurring-expenses");
  revalidatePath(`/recurring-expenses/${id}`);
  return { success: true };
}

export async function resumeRecurringExpense(id: string) {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");

  const [existing] = await db
    .select()
    .from(recurringExpenses)
    .where(
      and(
        eq(recurringExpenses.id, id),
        eq(recurringExpenses.orgId, session.org.id),
      ),
    );

  if (!existing)
    return { success: false, error: "Recurring expense not found" };
  if (existing.status !== RECURRING_EXPENSE_STATUS.PAUSED) {
    return {
      success: false,
      error: "Only paused recurring expenses can be resumed",
    };
  }

  await db
    .update(recurringExpenses)
    .set({ status: RECURRING_EXPENSE_STATUS.ACTIVE, updatedAt: new Date() })
    .where(eq(recurringExpenses.id, id));

  revalidatePath("/recurring-expenses");
  revalidatePath(`/recurring-expenses/${id}`);
  return { success: true };
}

export async function deleteRecurringExpense(id: string) {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");

  const [existing] = await db
    .select()
    .from(recurringExpenses)
    .where(
      and(
        eq(recurringExpenses.id, id),
        eq(recurringExpenses.orgId, session.org.id),
      ),
    );

  if (!existing)
    return { success: false, error: "Recurring expense not found" };

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
