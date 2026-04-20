"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/session";
import { expenseAttachments, invoiceSequences } from "@opentab/db/schema";
import {
  expenses,
  expenseItems,
  createExpenseSchema,
  updateExpenseSchema,
} from "@/lib/entities/expense";
import { eq, and } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  calculateLineTotal,
  calculateInvoiceTotals,
} from "@/lib/invoicing/calculations";
import { formatInvoiceNumber } from "@/lib/invoicing/numbering";
import { computeFileHash } from "@/lib/expenses/duplicate-detection";
import { matchSupplier } from "@/lib/expenses/supplier-matching";
import { ensureCategoriesSeeded } from "@/lib/expenses/category-seed";
import { createDraftExpense } from "@/lib/expenses/draft-expenses";
import {
  generateTempId,
  storeTempFile,
  deleteTempFile,
  moveTempToExpense,
} from "@/lib/expenses/file-storage";
import { extractReceiptData } from "@/lib/expenses/ai-extraction";
import {
  isReceiptExtractionEnabled,
  getAiSettingsSecret,
} from "@/lib/actions/ai-settings";
import { createLogger } from "@/lib/logging/logger";

const log = createLogger("expenses");

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

  const parsed = createExpenseSchema.safeParse({
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

  // Handle attachment if provided
  const attachmentJson = formData.get("attachment") as string | null;
  if (attachmentJson) {
    const attachment = JSON.parse(attachmentJson) as UploadedFileInfo;
    const finalPath = await moveTempToExpense(
      attachment.filePath,
      session.org.id,
      expense.id,
    );

    await db.insert(expenseAttachments).values({
      expenseId: expense.id,
      filePath: finalPath,
      fileName: attachment.fileName,
      mimeType: attachment.mimeType,
      fileSize: attachment.fileSize,
      fileHash: attachment.fileHash,
      aiStatus: "completed",
    });
  }

  revalidatePath("/expenses");
  return { success: true, expense };
}

export interface UploadedFileInfo {
  tempId: string;
  filePath: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  fileHash: string;
}

export interface UploadReceiptResult {
  success: boolean;
  error?: string;
  fileInfo?: UploadedFileInfo;
  extractedData?: {
    vendorName: string | null;
    vendorVat: string | null;
    date: string | null;
    totalAmount: string | null;
    currency: string | null;
    description: string | null;
    category: string | null;
    lineItems: {
      name: string;
      quantity: string;
      unitPrice: string;
      taxRate: string;
    }[];
  } | null;
  supplierMatch?: { contactId: string; displayName: string } | null;
}

export async function uploadAndExtractReceipt(
  formData: FormData,
): Promise<UploadReceiptResult> {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");

  const file = formData.get("file") as File | null;
  if (!file) return { success: false, error: "No file provided" };

  const totalTimer = log.time("upload-and-extract");
  const mimeType = file.type || "application/octet-stream";

  log.info("receipt upload started", {
    orgId: session.org.id,
    fileName: file.name,
    mimeType,
    fileSize: file.size,
  });

  const buffer = Buffer.from(await file.arrayBuffer());
  const hash = computeFileHash(buffer);

  // Check for duplicates
  const [duplicate] = await db
    .select()
    .from(expenseAttachments)
    .where(eq(expenseAttachments.fileHash, hash))
    .limit(1);

  if (duplicate) {
    log.info("duplicate receipt detected", {
      orgId: session.org.id,
      fileHash: hash,
    });
    return { success: false, error: "This file has already been uploaded" };
  }

  // Store file immediately
  const storeTimer = log.time("file-store");
  const tempId = generateTempId();
  const filePath = await storeTempFile(
    session.org.id,
    tempId,
    buffer,
    file.name,
  );
  storeTimer("file stored", { tempId, filePath });

  const fileInfo: UploadedFileInfo = {
    tempId,
    filePath,
    fileName: file.name,
    mimeType,
    fileSize: buffer.length,
    fileHash: hash,
  };

  // Try AI extraction if enabled
  let extractedData = null;
  let supplierMatch = null;

  const extractionEnabled = await isReceiptExtractionEnabled(session.org.id);
  if (extractionEnabled) {
    const aiSecrets = await getAiSettingsSecret(session.org.id);
    if (aiSecrets?.apiKey) {
      log.info("ai extraction starting", {
        orgId: session.org.id,
        model: aiSecrets.model,
        mimeType,
      });

      const extractTimer = log.time("ai-extraction");
      extractedData = await extractReceiptData(
        buffer,
        mimeType,
        aiSecrets.apiKey,
        aiSecrets.model,
      );
      extractTimer(
        extractedData
          ? "ai extraction succeeded"
          : "ai extraction returned no data",
        {
          model: aiSecrets.model,
          hasResult: !!extractedData,
          vendorName: extractedData?.vendorName ?? null,
          totalAmount: extractedData?.totalAmount ?? null,
        },
      );

      // Try supplier matching if we got a VAT number or name
      if (extractedData?.vendorVat) {
        supplierMatch = await matchSupplier(
          session.org.id,
          extractedData.vendorVat,
          extractedData.vendorName,
        );
      } else if (extractedData?.vendorName) {
        supplierMatch = await matchSupplier(
          session.org.id,
          null,
          extractedData.vendorName,
        );
      }

      if (supplierMatch) {
        log.info("supplier matched", {
          orgId: session.org.id,
          contactId: supplierMatch.contactId,
          displayName: supplierMatch.displayName,
        });
      }
    } else {
      log.warn("ai extraction enabled but no API key configured", {
        orgId: session.org.id,
      });
    }
  } else {
    log.debug("ai extraction disabled", { orgId: session.org.id });
  }

  totalTimer("upload and extract complete", {
    hasExtraction: !!extractedData,
    hasSupplierMatch: !!supplierMatch,
  });

  return { success: true, fileInfo, extractedData, supplierMatch };
}

export async function cleanupTempAttachment(filePath: string) {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");

  // Only allow deleting temp files (safety check)
  if (!filePath.includes("/tmp/")) return { success: false };

  await deleteTempFile(filePath);
  return { success: true };
}

export async function updateExpense(id: string, formData: FormData) {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");

  const [existing] = await db
    .select()
    .from(expenses)
    .where(and(eq(expenses.id, id), eq(expenses.orgId, session.org.id)));

  if (!existing) return { success: false, error: { _: ["Expense not found"] } };

  let rawItems: unknown;
  try {
    rawItems = JSON.parse((formData.get("items") as string) ?? "[]");
  } catch {
    return { success: false, error: { items: ["Invalid line items data"] } };
  }

  const parsed = updateExpenseSchema.safeParse({
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

export async function deleteExpense(id: string) {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");

  const [expense] = await db
    .select()
    .from(expenses)
    .where(and(eq(expenses.id, id), eq(expenses.orgId, session.org.id)));

  if (!expense) return { success: false, error: "Expense not found" };

  // Delete attached files from storage before removing the DB record
  const attachments = await db
    .select({ filePath: expenseAttachments.filePath })
    .from(expenseAttachments)
    .where(eq(expenseAttachments.expenseId, id));

  for (const att of attachments) {
    await deleteTempFile(att.filePath);
  }

  await db
    .delete(expenses)
    .where(and(eq(expenses.id, id), eq(expenses.orgId, session.org.id)));

  log.info("expense deleted", {
    orgId: session.org.id,
    expenseId: id,
    attachmentsDeleted: attachments.length,
  });

  revalidatePath("/expenses");
  return { success: true };
}
