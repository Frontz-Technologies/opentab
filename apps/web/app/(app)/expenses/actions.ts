"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/session";
import {
  expenses,
  expenseItems,
  expenseAttachments,
  invoiceSequences,
  EXPENSE_STATUS,
  EXPENSE_SOURCE,
  AI_STATUS,
} from "@opentab/db/schema";
import { eq, and } from "drizzle-orm";
import { db } from "@/lib/db";
import { z } from "zod";
import { formatInvoiceNumber } from "@/lib/invoicing/numbering";
import {
  calculateLineTotal,
  calculateExpenseTotals,
} from "@/lib/expenses/calculations";
import { computeFileHash } from "@/lib/expenses/duplicate-detection";
import {
  storeFile,
  buildExpenseFilePath,
  getExtensionFromMimeType,
  isProcessableFile,
  MAX_FILE_SIZE,
} from "@/lib/expenses/file-storage";

const expenseLineItemSchema = z.object({
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

const expenseSchema = z.object({
  contactId: z.string().uuid().optional().or(z.literal("")),
  categoryId: z.string().uuid().optional().or(z.literal("")),
  issueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
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

async function getOrCreateSequence(orgId: string, type: string) {
  const [existing] = await db
    .select()
    .from(invoiceSequences)
    .where(
      and(eq(invoiceSequences.orgId, orgId), eq(invoiceSequences.type, type)),
    );

  if (existing) return existing;

  const defaults: Record<string, string> = {
    invoice: "INV-",
    quote: "QTE-",
    expense: "EXP-",
  };

  const [seq] = await db
    .insert(invoiceSequences)
    .values({
      orgId,
      type,
      prefix: defaults[type] ?? "EXP-",
    })
    .returning();

  return seq;
}

async function generateNextNumber(
  orgId: string,
  type: string,
): Promise<string> {
  const seq = await getOrCreateSequence(orgId, type);

  const number = formatInvoiceNumber({
    prefix: seq.prefix,
    nextNumber: seq.nextNumber,
    digitCount: seq.digitCount,
    includeYear: seq.includeYear,
  });

  await db
    .update(invoiceSequences)
    .set({ nextNumber: seq.nextNumber + 1 })
    .where(eq(invoiceSequences.id, seq.id));

  return number;
}

export async function createExpense(formData: FormData) {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");

  const rawItems = JSON.parse(formData.get("items") as string);

  const parsed = expenseSchema.safeParse({
    contactId: formData.get("contactId") || undefined,
    categoryId: formData.get("categoryId") || undefined,
    issueDate: formData.get("issueDate"),
    paymentDate: formData.get("paymentDate") || undefined,
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

  const totals = calculateExpenseTotals(
    data.items.map((i) => ({
      quantity: i.quantity,
      unitPrice: i.unitPrice,
      taxRate: i.taxRate,
    })),
    usesInclusiveTax,
  );

  const expenseNumber = await generateNextNumber(session.org.id, "expense");

  const [expense] = await db
    .insert(expenses)
    .values({
      orgId: session.org.id,
      contactId: data.contactId || null,
      categoryId: data.categoryId || null,
      expenseNumber,
      issueDate: data.issueDate,
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
      source: EXPENSE_SOURCE.MANUAL,
    })
    .returning();

  for (const item of data.items) {
    const lineTotals = calculateLineTotal({
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      taxRate: item.taxRate,
      usesInclusiveTax,
    });

    await db.insert(expenseItems).values({
      expenseId: expense.id,
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

  const rawItems = JSON.parse(formData.get("items") as string);

  const parsed = expenseSchema.safeParse({
    contactId: formData.get("contactId") || undefined,
    categoryId: formData.get("categoryId") || undefined,
    issueDate: formData.get("issueDate"),
    paymentDate: formData.get("paymentDate") || undefined,
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

  const totals = calculateExpenseTotals(
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
      issueDate: data.issueDate,
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

  // Replace all line items
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
    .set({
      status: EXPENSE_STATUS.CONFIRMED,
      updatedAt: new Date(),
    })
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
  if (expense.status === EXPENSE_STATUS.CANCELLED) {
    return { success: false, error: "Expense is already cancelled" };
  }

  await db
    .update(expenses)
    .set({
      status: EXPENSE_STATUS.CANCELLED,
      updatedAt: new Date(),
    })
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
  if (!file) {
    return { success: false, error: "No file provided" };
  }

  if (!isProcessableFile(file.type)) {
    return {
      success: false,
      error: "Unsupported file type. Use PDF, JPEG, PNG, or WebP.",
    };
  }

  if (file.size > MAX_FILE_SIZE) {
    return { success: false, error: "File too large. Maximum size is 10 MB." };
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const fileHash = computeFileHash(buffer);

  // Generate expense number and create draft
  const expenseNumber = await generateNextNumber(session.org.id, "expense");
  const today = new Date().toISOString().split("T")[0];

  const [expense] = await db
    .insert(expenses)
    .values({
      orgId: session.org.id,
      expenseNumber,
      issueDate: today,
      source: EXPENSE_SOURCE.AI_EXTRACT,
      fileHash,
    })
    .returning();

  // Store file
  const ext = getExtensionFromMimeType(file.type);
  const relativePath = buildExpenseFilePath(session.org.id, expense.id, ext);
  await storeFile(relativePath, buffer);

  // Create attachment record
  await db.insert(expenseAttachments).values({
    expenseId: expense.id,
    filePath: relativePath,
    fileName: file.name,
    fileSize: file.size,
    mimeType: file.type,
    fileHash,
    aiStatus: AI_STATUS.PENDING,
  });

  // AI extraction would be enqueued here via BullMQ in production
  // For now, the expense is created as a draft for manual review

  revalidatePath("/expenses");
  return { success: true, expense };
}
