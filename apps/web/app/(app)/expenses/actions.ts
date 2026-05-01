"use server";

import { revalidatePath } from "next/cache";
import { lookupVat as lookupVatAction } from "../contacts/actions";
import { detectCountryFromTaxId } from "@/lib/utils";

export async function lookupVat(vatNumber: string) {
  return lookupVatAction(vatNumber);
}

export async function findContactByVat(vatNumber: string) {
  const cleaned = vatNumber.trim().replace(/\s/g, "").toUpperCase();
  if (!cleaned) return null;

  const session = await getSession();
  if (!session) throw new Error("Unauthorized");

  const rows = await db
    .select()
    .from(contacts)
    .where(
      and(eq(contacts.orgId, session.org.id), eq(contacts.vatNumber, cleaned)),
    )
    .limit(1);

  return rows[0] ?? null;
}

export async function createSupplierContact(input: {
  supplierName: string;
  supplierVat: string;
  address?: string;
  city?: string;
  postalCode?: string;
  taxOffice?: string;
}) {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");

  if (!input.supplierName.trim()) {
    return { success: false as const, error: "Name is required" };
  }

  const cleanedVat = input.supplierVat.trim().replace(/\s/g, "").toUpperCase();
  const detectedCountry = cleanedVat
    ? detectCountryFromTaxId(cleanedVat)
    : null;

  const trimmedName = input.supplierName.trim();
  const [contact] = await db
    .insert(contacts)
    .values({
      orgId: session.org.id,
      type: "supplier",
      classification: "business",
      displayName: trimmedName,
      company: trimmedName,
      vatNumber: cleanedVat || null,
      countryCode: detectedCountry || session.org.countryCode || null,
      addressLine1: input.address?.trim() || null,
      city: input.city?.trim() || null,
      postalCode: input.postalCode?.trim() || null,
      taxOffice: input.taxOffice?.trim() || null,
    })
    .returning();

  revalidatePath("/contacts");

  return {
    success: true as const,
    contact: {
      id: contact.id,
      displayName: contact.displayName,
      company: contact.company,
      vatNumber: contact.vatNumber,
      type: contact.type,
    },
  };
}
import { getSession } from "@/lib/session";
import {
  contacts,
  expenseAttachments,
  expenseCategories,
  invoiceSequences,
} from "@opentab/db/schema";
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
  assertContactInOrg,
  assertExpenseCategoryInOrg,
  CROSS_ORG_ACCESS_ERROR,
} from "@/lib/security/assert-same-org";
import { getFxRate } from "@/lib/fx/get-rate";
import {
  isSupportedCurrency,
  type SupportedCurrencyCode,
} from "@/lib/currency/supported";
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
      .where(
        and(eq(invoiceSequences.id, seq.id), eq(invoiceSequences.orgId, orgId)),
      );

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

export type ReceiptExtractedData = {
  vendorName: string | null;
  vendorVat: string | null;
  date: string | null;
  totalAmount: string | null;
  currency: string | null;
  description: string | null;
  categoryId: string | null;
  lineItems: {
    name: string;
    quantity: string;
    unitPrice: string;
    taxRate: string;
  }[];
};

export type ReceiptSupplierMatch = {
  contactId: string;
  displayName: string;
};

export type UploadReceiptResult =
  | {
      success: true;
      fileInfo: UploadedFileInfo;
      extractedData: ReceiptExtractedData | null;
      supplierMatch: ReceiptSupplierMatch | null;
    }
  | {
      // PR #276 unblocker — Sonner "Open existing expense" toast
      // needs the parent expenseId on the duplicate-receipt branch.
      // Safe to project because the SELECT below joins through
      // expense.orgId, so the matched expense is guaranteed
      // same-org.
      success: false;
      error: "duplicate";
      duplicateExpenseId: string;
    }
  | { success: false; error: string };

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

  // Check for duplicates — scope by orgId so a hash collision in
  // another org doesn't leak existence (and isn't blocked here).
  // expenseAttachments has no orgId column, so we JOIN through
  // expenses, which carries orgId. Project expenseId so the client
  // can offer "open existing expense" UX (PR #276) — safe because
  // the JOIN already filters to same-org rows.
  const [duplicate] = await db
    .select({
      id: expenseAttachments.id,
      expenseId: expenseAttachments.expenseId,
    })
    .from(expenseAttachments)
    .innerJoin(expenses, eq(expenses.id, expenseAttachments.expenseId))
    .where(
      and(
        eq(expenseAttachments.fileHash, hash),
        eq(expenses.orgId, session.org.id),
      ),
    )
    .limit(1);

  if (duplicate) {
    log.info("duplicate receipt detected", {
      orgId: session.org.id,
      fileHash: hash,
      duplicateExpenseId: duplicate.expenseId,
    });
    return {
      success: false as const,
      error: "duplicate" as const,
      duplicateExpenseId: duplicate.expenseId,
    };
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
  let extractedData: ReceiptExtractedData | null = null;
  let supplierMatch: ReceiptSupplierMatch | null = null;

  const extractionEnabled = await isReceiptExtractionEnabled(session.org.id);
  if (extractionEnabled) {
    const aiSecrets = await getAiSettingsSecret(session.org.id, "extraction");
    if (aiSecrets?.apiKey) {
      log.info("ai extraction starting", {
        orgId: session.org.id,
        model: aiSecrets.model,
        mimeType,
      });

      // Fetch the org's active categories so the model can pick a real code.
      const activeCategories = await db
        .select({
          id: expenseCategories.id,
          code: expenseCategories.code,
          name: expenseCategories.name,
        })
        .from(expenseCategories)
        .where(
          and(
            eq(expenseCategories.orgId, session.org.id),
            eq(expenseCategories.active, true),
          ),
        );

      const extractTimer = log.time("ai-extraction");
      const raw = await extractReceiptData(
        buffer,
        mimeType,
        aiSecrets.apiKey,
        aiSecrets.model,
        activeCategories.map((c) => ({ code: c.code, name: c.name })),
      );
      extractTimer(
        raw ? "ai extraction succeeded" : "ai extraction returned no data",
        {
          model: aiSecrets.model,
          hasResult: !!raw,
          vendorName: raw?.vendorName ?? null,
          totalAmount: raw?.totalAmount ?? null,
        },
      );

      if (raw) {
        const categoryId = raw.categoryCode
          ? (activeCategories.find((c) => c.code === raw.categoryCode)?.id ??
            null)
          : null;
        extractedData = {
          vendorName: raw.vendorName,
          vendorVat: raw.vendorVat,
          date: raw.date,
          totalAmount: raw.totalAmount,
          currency: raw.currency,
          description: raw.description,
          categoryId,
          lineItems: raw.lineItems,
        };
      }

      // Try supplier matching if we got a VAT number or name
      if (raw?.vendorVat) {
        supplierMatch = await matchSupplier(
          session.org.id,
          raw.vendorVat,
          raw.vendorName,
        );
      } else if (raw?.vendorName) {
        supplierMatch = await matchSupplier(
          session.org.id,
          null,
          raw.vendorName,
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

  // #274 carry-over: validate contactId / categoryId belong to the
  // session org BEFORE the UPDATE. The Zod schema accepts any UUID;
  // without this guard a cross-org id would either crash on the FK
  // constraint (opaque error) or, if both contacts.id and the
  // wrong-org row exist, silently link the expense to another org's
  // row. Mirror of the createDraftExpense check.
  try {
    if (data.contactId) {
      await assertContactInOrg(db, data.contactId, session.org.id);
    }
    if (data.categoryId) {
      await assertExpenseCategoryInOrg(db, data.categoryId, session.org.id);
    }
  } catch (err) {
    if (err instanceof Error && err.message === CROSS_ORG_ACCESS_ERROR) {
      return {
        success: false,
        error: { _: ["Referenced contact or category not found"] },
      };
    }
    throw err;
  }

  const totals = calculateInvoiceTotals(
    data.items.map((i) => ({
      quantity: i.quantity,
      unitPrice: i.unitPrice,
      taxRate: i.taxRate,
    })),
    usesInclusiveTax,
  );

  // Refresh the FX snapshot only when currency or expense date changed
  // since the previous version. Otherwise keep the original rate so
  // historical reports stay deterministic for unrelated edits.
  let nextExchangeRate = existing.exchangeRate;
  const currencyChanged = data.currencyCode !== existing.currencyCode;
  const dateChanged = data.expenseDate !== existing.expenseDate;
  if (
    (currencyChanged || dateChanged) &&
    isSupportedCurrency(data.currencyCode) &&
    isSupportedCurrency(session.org.defaultCurrency)
  ) {
    const fx = await getFxRate(
      new Date(`${data.expenseDate}T00:00:00Z`),
      data.currencyCode as SupportedCurrencyCode,
      session.org.defaultCurrency as SupportedCurrencyCode,
    );
    nextExchangeRate = fx.rate.toFixed(6);
  }

  await db
    .update(expenses)
    .set({
      contactId: data.contactId || null,
      categoryId: data.categoryId || null,
      expenseDate: data.expenseDate,
      paymentDate: data.paymentDate || null,
      currencyCode: data.currencyCode,
      exchangeRate: nextExchangeRate,
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

  // Collect file paths BEFORE the DB delete (the cascade will drop
  // the attachment rows and we'd lose the paths). The actual file
  // deletion is enqueued so the action returns fast — the worker
  // owns the storage cleanup (#85).
  const attachments = await db
    .select({ filePath: expenseAttachments.filePath })
    .from(expenseAttachments)
    .where(eq(expenseAttachments.expenseId, id));

  await db
    .delete(expenses)
    .where(and(eq(expenses.id, id), eq(expenses.orgId, session.org.id)));

  if (attachments.length > 0) {
    // Best-effort enqueue (tester PR #216 Medium #2). Redis being
    // unreachable at delete time would otherwise throw a 500 to the
    // user even though the expense row is already gone. Swallow,
    // log, and continue — cleanup-temp-files (24h repeatable) is
    // the safety net that sweeps up the orphaned files.
    try {
      const { enqueue } = await import("@/lib/jobs/queues");
      await enqueue("delete-expense-files", {
        orgId: session.org.id,
        expenseId: id,
        filePaths: attachments.map((a) => a.filePath),
      });
    } catch (err) {
      log.warn(
        "delete-expense-files enqueue failed; cleanup-temp-files will sweep",
        {
          orgId: session.org.id,
          expenseId: id,
          attachmentCount: attachments.length,
          errorMessage: err instanceof Error ? err.message : String(err),
        },
      );
    }
  }

  log.info("expense deleted", {
    orgId: session.org.id,
    expenseId: id,
    attachmentsEnqueued: attachments.length,
  });

  revalidatePath("/expenses");
  return { success: true };
}
