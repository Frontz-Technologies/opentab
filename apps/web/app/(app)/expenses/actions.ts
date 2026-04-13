"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/session";
import {
  expenses,
  expenseItems,
  expenseAttachments,
  invoiceSequences,
  EXPENSE_STATUS,
} from "@opentab/db/schema";
import { eq, and } from "drizzle-orm";
import { db } from "@/lib/db";
import { z } from "zod";
import {
  calculateLineTotal,
  calculateInvoiceTotals,
} from "@/lib/invoicing/calculations";
import { formatInvoiceNumber } from "@/lib/invoicing/numbering";
import { computeFileHash } from "@/lib/expenses/duplicate-detection";
import { matchSupplier } from "@/lib/expenses/supplier-matching";
import { ensureCategoriesSeeded } from "@/lib/expenses/category-seed";
import { createDraftExpense } from "@/lib/expenses/draft-expenses";

const lineItemSchema = z.object({
  sortOrder: z.coerce.number().int().min(0),
  name: z.string().min(1).max(255),
  description: z.string().optional().default(""),
  quantity: z.string().regex(/^\d+(\.\d{1,4})?$/),
  unitPrice: z.string().regex(/^\d+(\.\d{1,2})?$/),
  taxRate: z.string().regex(/^\d+(\.\d{1,2})?$/),
});

const expenseSchema = z.object({
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
  items: z.array(lineItemSchema).min(1, "At least one line item is required"),
});

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

  if (existing) return existing;

  const [seq] = await db
    .insert(invoiceSequences)
    .values({
      orgId,
      type: "expense",
      prefix: "EXP-",
    })
    .returning();

  return seq;
}

async function generateExpenseNumber(orgId: string): Promise<string> {
  await getOrCreateExpenseSequence(orgId);

  return await db.transaction(async (tx) => {
    const [seq] = await tx
      .select()
      .from(invoiceSequences)
      .where(
        and(
          eq(invoiceSequences.orgId, orgId),
          eq(invoiceSequences.type, "expense"),
        ),
      )
      .for("update");

    const number = formatInvoiceNumber({
      prefix: seq.prefix,
      nextNumber: seq.nextNumber,
      digitCount: seq.digitCount,
      includeYear: seq.includeYear,
    });

    await tx
      .update(invoiceSequences)
      .set({ nextNumber: seq.nextNumber + 1 })
      .where(eq(invoiceSequences.id, seq.id));

    return number;
  });
}

export async function createExpense(formData: FormData) {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");

  await ensureCategoriesSeeded(session.org.id, session.org.countryCode);

  let rawItems: unknown;
  try {
    rawItems = JSON.parse((formData.get("items") as string) ?? "[]");
  } catch {
    return { success: false, error: { items: ["Invalid line items data"] } };
  }

  const parsed = expenseSchema.safeParse({
    contactId: formData.get("contactId") ?? "",
    categoryId: formData.get("categoryId") ?? "",
    expenseDate: formData.get("expenseDate"),
    paymentDate: formData.get("paymentDate") ?? "",
    currencyCode: formData.get("currencyCode") ?? "EUR",
    usesInclusiveTax: formData.get("usesInclusiveTax") === "true",
    supplierInvoiceNumber: formData.get("supplierInvoiceNumber") ?? "",
    contactName: formData.get("contactName") ?? "",
    contactVatNumber: formData.get("contactVatNumber") ?? "",
    description: formData.get("description") ?? "",
    notes: formData.get("notes") ?? "",
    items: rawItems,
  });

  if (!parsed.success) {
    return { success: false, error: parsed.error.flatten().fieldErrors };
  }

  const { expense } = await createDraftExpense(session.org.id, parsed.data);

  revalidatePath("/expenses");
  return { success: true, expense };
}

export async function updateExpense(id: string, formData: FormData) {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");

  const [existing] = await db
    .select()
    .from(expenses)
    .where(and(eq(expenses.id, id), eq(expenses.orgId, session.org.id)));

  if (!existing) return { success: false, error: { _: ["Expense not found"] } };
  if (existing.status !== EXPENSE_STATUS.DRAFT) {
    return {
      success: false,
      error: { _: ["Only draft expenses can be edited"] },
    };
  }

  let rawItems: unknown;
  try {
    rawItems = JSON.parse((formData.get("items") as string) ?? "[]");
  } catch {
    return { success: false, error: { items: ["Invalid line items data"] } };
  }

  const parsed = expenseSchema.safeParse({
    contactId: formData.get("contactId") ?? "",
    categoryId: formData.get("categoryId") ?? "",
    expenseDate: formData.get("expenseDate"),
    paymentDate: formData.get("paymentDate") ?? "",
    currencyCode: formData.get("currencyCode") ?? "EUR",
    usesInclusiveTax: formData.get("usesInclusiveTax") === "true",
    supplierInvoiceNumber: formData.get("supplierInvoiceNumber") ?? "",
    contactName: formData.get("contactName") ?? "",
    contactVatNumber: formData.get("contactVatNumber") ?? "",
    description: formData.get("description") ?? "",
    notes: formData.get("notes") ?? "",
    items: rawItems,
  });

  if (!parsed.success) {
    return { success: false, error: parsed.error.flatten().fieldErrors };
  }

  const data = parsed.data;
  const usesInclusiveTax = data.usesInclusiveTax;

  const totals = calculateInvoiceTotals(
    data.items.map((i) => ({
      quantity: i.quantity,
      unitPrice: i.unitPrice,
      taxRate: i.taxRate,
    })),
    usesInclusiveTax,
  );

  await db
    .update(expenses)
    .set({
      contactId: data.contactId || null,
      categoryId: data.categoryId || null,
      expenseDate: data.expenseDate,
      paymentDate: data.paymentDate || null,
      currencyCode: data.currencyCode,
      usesInclusiveTax,
      subtotal: totals.subtotal,
      taxAmount: totals.taxAmount,
      total: totals.total,
      supplierInvoiceNumber: data.supplierInvoiceNumber || null,
      contactName: data.contactName || null,
      contactVatNumber: data.contactVatNumber || null,
      description: data.description || null,
      notes: data.notes || null,
      updatedAt: new Date(),
    })
    .where(and(eq(expenses.id, id), eq(expenses.orgId, session.org.id)));

  await db.delete(expenseItems).where(eq(expenseItems.expenseId, id));

  for (const item of data.items) {
    const lineTotals = calculateLineTotal({
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      taxRate: item.taxRate,
      usesInclusiveTax,
    });

    await db.insert(expenseItems).values({
      expenseId: id,
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

  revalidatePath("/expenses");
  revalidatePath(`/expenses/${id}`);
  return { success: true };
}

export async function confirmExpense(id: string) {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");

  const [expense] = await db
    .select()
    .from(expenses)
    .where(and(eq(expenses.id, id), eq(expenses.orgId, session.org.id)));

  if (!expense) return { success: false, error: "Expense not found" };
  if (expense.status !== EXPENSE_STATUS.DRAFT) {
    return { success: false, error: "Only draft expenses can be confirmed" };
  }

  await db
    .update(expenses)
    .set({ status: EXPENSE_STATUS.CONFIRMED, updatedAt: new Date() })
    .where(eq(expenses.id, id));

  revalidatePath("/expenses");
  revalidatePath(`/expenses/${id}`);
  return { success: true };
}

export async function cancelExpense(id: string) {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");

  const [expense] = await db
    .select()
    .from(expenses)
    .where(and(eq(expenses.id, id), eq(expenses.orgId, session.org.id)));

  if (!expense) return { success: false, error: "Expense not found" };

  await db
    .update(expenses)
    .set({ status: EXPENSE_STATUS.CANCELLED, updatedAt: new Date() })
    .where(eq(expenses.id, id));

  revalidatePath("/expenses");
  revalidatePath(`/expenses/${id}`);
  return { success: true };
}

export async function deleteExpense(id: string) {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");

  const [expense] = await db
    .select()
    .from(expenses)
    .where(and(eq(expenses.id, id), eq(expenses.orgId, session.org.id)));

  if (!expense) return { success: false, error: "Expense not found" };
  if (expense.status !== EXPENSE_STATUS.DRAFT) {
    return { success: false, error: "Only draft expenses can be deleted" };
  }

  await db
    .delete(expenses)
    .where(and(eq(expenses.id, id), eq(expenses.orgId, session.org.id)));

  revalidatePath("/expenses");
  return { success: true };
}

export async function uploadReceipt(formData: FormData) {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");

  const file = formData.get("file") as File | null;
  if (!file) return { success: false, error: "No file provided" };

  const buffer = Buffer.from(await file.arrayBuffer());
  const hash = computeFileHash(buffer);

  // Check for duplicates
  const [duplicate] = await db
    .select()
    .from(expenseAttachments)
    .where(eq(expenseAttachments.fileHash, hash))
    .limit(1);

  if (duplicate) {
    return {
      success: false,
      error: "This file has already been uploaded",
    };
  }

  await ensureCategoriesSeeded(session.org.id, session.org.countryCode);

  const expenseNumber = await generateExpenseNumber(session.org.id);

  // Try to match supplier from VAT
  const supplierMatch = await matchSupplier(session.org.id, null, null);

  const [expense] = await db
    .insert(expenses)
    .values({
      orgId: session.org.id,
      contactId: supplierMatch?.contactId ?? null,
      expenseNumber,
      expenseDate: new Date().toISOString().split("T")[0],
      source: "ai_extract",
      fileHash: hash,
      contactName: supplierMatch?.displayName ?? null,
    })
    .returning();

  const { storeFile } = await import("@/lib/expenses/file-storage");
  const filePath = await storeFile(
    session.org.id,
    expense.id,
    buffer,
    file.name,
  );

  await db.insert(expenseAttachments).values({
    expenseId: expense.id,
    filePath,
    fileName: file.name,
    mimeType: file.type || "application/octet-stream",
    fileSize: buffer.length,
    fileHash: hash,
    aiStatus: "pending",
  });

  revalidatePath("/expenses");
  return { success: true, expense };
}
