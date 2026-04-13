"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/session";
import {
  recurringInvoices,
  recurringInvoiceItems,
  RECURRING_STATUS,
} from "@opentab/db/schema";
import { eq, and } from "drizzle-orm";
import { db } from "@/lib/db";
import { z } from "zod";
import { calculateLineTotal } from "@/lib/invoicing/calculations";

const lineItemSchema = z.object({
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

const recurringSchema = z.object({
  contactId: z.string().uuid(),
  frequency: z.coerce.number().int().min(1).max(7),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .or(z.literal("")),
  nextSendDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  remainingCycles: z.coerce.number().int().min(0).optional(),
  autoSend: z.coerce.boolean().default(false),
  usesInclusiveTax: z.coerce.boolean().default(false),
  currencyCode: z.string().length(3).default("EUR"),
  notes: z.string().optional().default(""),
  terms: z.string().optional().default(""),
  items: z.array(lineItemSchema).min(1),
});

export async function createRecurring(formData: FormData) {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");

  const rawItems = JSON.parse(formData.get("items") as string);
  const parsed = recurringSchema.safeParse({
    contactId: formData.get("contactId"),
    frequency: formData.get("frequency"),
    startDate: formData.get("startDate"),
    endDate: formData.get("endDate") || undefined,
    nextSendDate: formData.get("nextSendDate") || formData.get("startDate"),
    remainingCycles: formData.get("remainingCycles") || undefined,
    autoSend: formData.get("autoSend") === "true",
    usesInclusiveTax: formData.get("usesInclusiveTax") === "true",
    currencyCode: formData.get("currencyCode") ?? "EUR",
    notes: formData.get("notes") ?? "",
    terms: formData.get("terms") ?? "",
    items: rawItems,
  });

  if (!parsed.success) {
    return { success: false, error: parsed.error.flatten().fieldErrors };
  }

  const data = parsed.data;

  const [recurring] = await db
    .insert(recurringInvoices)
    .values({
      orgId: session.org.id,
      contactId: data.contactId,
      frequency: data.frequency,
      startDate: data.startDate,
      endDate: data.endDate || null,
      nextSendDate: data.nextSendDate,
      remainingCycles: data.remainingCycles ?? null,
      autoSend: data.autoSend,
      usesInclusiveTax: data.usesInclusiveTax,
      currencyCode: data.currencyCode,
      notes: data.notes || null,
      terms: data.terms || null,
    })
    .returning();

  for (const item of data.items) {
    const lineTotals = calculateLineTotal({
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      taxRate: item.taxRate,
      usesInclusiveTax: data.usesInclusiveTax,
    });
    await db.insert(recurringInvoiceItems).values({
      recurringInvoiceId: recurring.id,
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

  revalidatePath("/recurring");
  return { success: true, recurring };
}

export async function updateRecurring(id: string, formData: FormData) {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");

  const rawItems = JSON.parse(formData.get("items") as string);
  const parsed = recurringSchema.safeParse({
    contactId: formData.get("contactId"),
    frequency: formData.get("frequency"),
    startDate: formData.get("startDate"),
    endDate: formData.get("endDate") || undefined,
    nextSendDate: formData.get("nextSendDate") || formData.get("startDate"),
    remainingCycles: formData.get("remainingCycles") || undefined,
    autoSend: formData.get("autoSend") === "true",
    usesInclusiveTax: formData.get("usesInclusiveTax") === "true",
    currencyCode: formData.get("currencyCode") ?? "EUR",
    notes: formData.get("notes") ?? "",
    terms: formData.get("terms") ?? "",
    items: rawItems,
  });

  if (!parsed.success) {
    return { success: false, error: parsed.error.flatten().fieldErrors };
  }

  const data = parsed.data;

  await db
    .update(recurringInvoices)
    .set({
      contactId: data.contactId,
      frequency: data.frequency,
      startDate: data.startDate,
      endDate: data.endDate || null,
      nextSendDate: data.nextSendDate,
      remainingCycles: data.remainingCycles ?? null,
      autoSend: data.autoSend,
      usesInclusiveTax: data.usesInclusiveTax,
      currencyCode: data.currencyCode,
      notes: data.notes || null,
      terms: data.terms || null,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(recurringInvoices.id, id),
        eq(recurringInvoices.orgId, session.org.id),
      ),
    );

  await db
    .delete(recurringInvoiceItems)
    .where(eq(recurringInvoiceItems.recurringInvoiceId, id));
  for (const item of data.items) {
    const lineTotals = calculateLineTotal({
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      taxRate: item.taxRate,
      usesInclusiveTax: data.usesInclusiveTax,
    });
    await db.insert(recurringInvoiceItems).values({
      recurringInvoiceId: id,
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

  revalidatePath("/recurring");
  revalidatePath(`/recurring/${id}`);
  return { success: true };
}

export async function pauseRecurring(id: string) {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");

  await db
    .update(recurringInvoices)
    .set({ status: RECURRING_STATUS.PAUSED, updatedAt: new Date() })
    .where(
      and(
        eq(recurringInvoices.id, id),
        eq(recurringInvoices.orgId, session.org.id),
      ),
    );

  revalidatePath("/recurring");
  revalidatePath(`/recurring/${id}`);
  return { success: true };
}

export async function resumeRecurring(id: string) {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");

  await db
    .update(recurringInvoices)
    .set({ status: RECURRING_STATUS.ACTIVE, updatedAt: new Date() })
    .where(
      and(
        eq(recurringInvoices.id, id),
        eq(recurringInvoices.orgId, session.org.id),
      ),
    );

  revalidatePath("/recurring");
  revalidatePath(`/recurring/${id}`);
  return { success: true };
}

export async function deleteRecurring(id: string) {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");

  await db
    .delete(recurringInvoices)
    .where(
      and(
        eq(recurringInvoices.id, id),
        eq(recurringInvoices.orgId, session.org.id),
      ),
    );

  revalidatePath("/recurring");
  return { success: true };
}
