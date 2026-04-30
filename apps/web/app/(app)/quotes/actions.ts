"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/session";
import {
  quotes,
  quoteItems,
  invoices,
  invoiceItems,
  invoiceSequences,
  QUOTE_STATUS,
} from "@opentab/db/schema";
import { eq, and } from "drizzle-orm";
import { db } from "@/lib/db";
import { z } from "zod";
import { formatInvoiceNumber } from "@/lib/invoicing/numbering";
import {
  calculateLineTotal,
  calculateInvoiceTotals,
} from "@/lib/invoicing/calculations";
import { getFxRate } from "@/lib/fx/get-rate";
import {
  isSupportedCurrency,
  type SupportedCurrencyCode,
} from "@/lib/currency/supported";

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

const quoteSchema = z.object({
  contactId: z.string().uuid(),
  issueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  validUntil: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .or(z.literal("")),
  currencyCode: z.string().length(3).default("EUR"),
  usesInclusiveTax: z.coerce.boolean().default(false),
  contactName: z.string().min(1).max(255),
  contactEmail: z.string().email().optional().or(z.literal("")),
  contactVatNumber: z.string().max(50).optional().default(""),
  contactAddress: z.string().optional().default(""),
  notes: z.string().optional().default(""),
  terms: z.string().optional().default(""),
  items: z.array(lineItemSchema).min(1),
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
  };

  const [seq] = await db
    .insert(invoiceSequences)
    .values({ orgId, type, prefix: defaults[type] ?? "INV-" })
    .returning();

  return seq;
}

async function generateNextNumber(
  orgId: string,
  type: string,
): Promise<string> {
  // Ensure sequence exists before entering the locking transaction
  await getOrCreateSequence(orgId, type);

  return await db.transaction(async (tx) => {
    const [seq] = await tx
      .select()
      .from(invoiceSequences)
      .where(
        and(eq(invoiceSequences.orgId, orgId), eq(invoiceSequences.type, type)),
      )
      .for("update");

    const number = formatInvoiceNumber({
      prefix: seq.prefix,
      nextNumber: seq.nextNumber,
      digitCount: seq.digitCount,
      includeYear: seq.includeYear,
      pattern: seq.pattern,
    });

    await tx
      .update(invoiceSequences)
      .set({ nextNumber: seq.nextNumber + 1 })
      .where(eq(invoiceSequences.id, seq.id));

    return number;
  });
}

export async function createQuote(formData: FormData) {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");

  let rawItems: unknown;
  try {
    rawItems = JSON.parse((formData.get("items") as string) ?? "[]");
  } catch {
    return { success: false, error: { items: ["Invalid line items data"] } };
  }
  const parsed = quoteSchema.safeParse({
    contactId: formData.get("contactId"),
    issueDate: formData.get("issueDate"),
    validUntil: formData.get("validUntil") || undefined,
    currencyCode: formData.get("currencyCode") ?? "EUR",
    usesInclusiveTax: formData.get("usesInclusiveTax") === "true",
    contactName: formData.get("contactName"),
    contactEmail: formData.get("contactEmail") ?? "",
    contactVatNumber: formData.get("contactVatNumber") ?? "",
    contactAddress: formData.get("contactAddress") ?? "",
    notes: formData.get("notes") ?? "",
    terms: formData.get("terms") ?? "",
    items: rawItems,
  });

  if (!parsed.success) {
    return { success: false, error: parsed.error.flatten().fieldErrors };
  }

  const data = parsed.data;
  const totals = calculateInvoiceTotals(
    data.items.map((i) => ({
      quantity: i.quantity,
      unitPrice: i.unitPrice,
      taxRate: i.taxRate,
    })),
    data.usesInclusiveTax,
  );

  // Snapshot the FX rate at save time so historical reports stay
  // stable even if ECB later revises a published rate. When the
  // quote currency matches the org default currency, getFxRate's
  // identity branch returns 1 — kept explicit so the fallthrough is
  // obvious to future readers.
  let exchangeRate = "1.000000";
  if (
    isSupportedCurrency(data.currencyCode) &&
    isSupportedCurrency(session.org.defaultCurrency)
  ) {
    const fx = await getFxRate(
      new Date(`${data.issueDate}T00:00:00Z`),
      data.currencyCode as SupportedCurrencyCode,
      session.org.defaultCurrency as SupportedCurrencyCode,
    );
    exchangeRate = fx.rate.toFixed(6);
  }

  const quoteNumber = await generateNextNumber(session.org.id, "quote");

  const [quote] = await db
    .insert(quotes)
    .values({
      orgId: session.org.id,
      contactId: data.contactId,
      quoteNumber,
      issueDate: data.issueDate,
      validUntil: data.validUntil || null,
      currencyCode: data.currencyCode,
      exchangeRate,
      usesInclusiveTax: data.usesInclusiveTax,
      subtotal: totals.subtotal,
      taxAmount: totals.taxAmount,
      total: totals.total,
      contactName: data.contactName,
      contactEmail: data.contactEmail || null,
      contactVatNumber: data.contactVatNumber || null,
      contactAddress: data.contactAddress || null,
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
    await db.insert(quoteItems).values({
      quoteId: quote.id,
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

  revalidatePath("/quotes");
  return { success: true, quote };
}

export async function updateQuote(id: string, formData: FormData) {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");

  const [existing] = await db
    .select()
    .from(quotes)
    .where(and(eq(quotes.id, id), eq(quotes.orgId, session.org.id)));

  if (!existing) return { success: false, error: { _: ["Quote not found"] } };
  if (existing.status !== QUOTE_STATUS.DRAFT) {
    return {
      success: false,
      error: { _: ["Only draft quotes can be edited"] },
    };
  }

  let rawItems: unknown;
  try {
    rawItems = JSON.parse((formData.get("items") as string) ?? "[]");
  } catch {
    return { success: false, error: { items: ["Invalid line items data"] } };
  }
  const parsed = quoteSchema.safeParse({
    contactId: formData.get("contactId"),
    issueDate: formData.get("issueDate"),
    validUntil: formData.get("validUntil") || undefined,
    currencyCode: formData.get("currencyCode") ?? "EUR",
    usesInclusiveTax: formData.get("usesInclusiveTax") === "true",
    contactName: formData.get("contactName"),
    contactEmail: formData.get("contactEmail") ?? "",
    contactVatNumber: formData.get("contactVatNumber") ?? "",
    contactAddress: formData.get("contactAddress") ?? "",
    notes: formData.get("notes") ?? "",
    terms: formData.get("terms") ?? "",
    items: rawItems,
  });

  if (!parsed.success) {
    return { success: false, error: parsed.error.flatten().fieldErrors };
  }

  const data = parsed.data;
  const totals = calculateInvoiceTotals(
    data.items.map((i) => ({
      quantity: i.quantity,
      unitPrice: i.unitPrice,
      taxRate: i.taxRate,
    })),
    data.usesInclusiveTax,
  );

  // Refresh the FX snapshot only when currency or issue date changed
  // since the previous version. Otherwise keep the original rate so
  // historical reports stay deterministic for unrelated edits.
  let nextExchangeRate = existing.exchangeRate;
  const currencyChanged = data.currencyCode !== existing.currencyCode;
  const dateChanged = data.issueDate !== existing.issueDate;
  if (
    (currencyChanged || dateChanged) &&
    isSupportedCurrency(data.currencyCode) &&
    isSupportedCurrency(session.org.defaultCurrency)
  ) {
    const fx = await getFxRate(
      new Date(`${data.issueDate}T00:00:00Z`),
      data.currencyCode as SupportedCurrencyCode,
      session.org.defaultCurrency as SupportedCurrencyCode,
    );
    nextExchangeRate = fx.rate.toFixed(6);
  }

  await db
    .update(quotes)
    .set({
      contactId: data.contactId,
      issueDate: data.issueDate,
      validUntil: data.validUntil || null,
      currencyCode: data.currencyCode,
      exchangeRate: nextExchangeRate,
      usesInclusiveTax: data.usesInclusiveTax,
      subtotal: totals.subtotal,
      taxAmount: totals.taxAmount,
      total: totals.total,
      contactName: data.contactName,
      contactEmail: data.contactEmail || null,
      contactVatNumber: data.contactVatNumber || null,
      contactAddress: data.contactAddress || null,
      notes: data.notes || null,
      terms: data.terms || null,
      updatedAt: new Date(),
    })
    .where(and(eq(quotes.id, id), eq(quotes.orgId, session.org.id)));

  await db.delete(quoteItems).where(eq(quoteItems.quoteId, id));
  for (const item of data.items) {
    const lineTotals = calculateLineTotal({
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      taxRate: item.taxRate,
      usesInclusiveTax: data.usesInclusiveTax,
    });
    await db.insert(quoteItems).values({
      quoteId: id,
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

  revalidatePath("/quotes");
  revalidatePath(`/quotes/${id}`);
  return { success: true };
}

export async function sendQuote(id: string) {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");

  await db
    .update(quotes)
    .set({ status: QUOTE_STATUS.SENT, updatedAt: new Date() })
    .where(and(eq(quotes.id, id), eq(quotes.orgId, session.org.id)));

  revalidatePath("/quotes");
  revalidatePath(`/quotes/${id}`);
  return { success: true };
}

export async function acceptQuote(id: string) {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");

  await db
    .update(quotes)
    .set({ status: QUOTE_STATUS.ACCEPTED, updatedAt: new Date() })
    .where(and(eq(quotes.id, id), eq(quotes.orgId, session.org.id)));

  revalidatePath("/quotes");
  revalidatePath(`/quotes/${id}`);
  return { success: true };
}

export async function rejectQuote(id: string) {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");

  await db
    .update(quotes)
    .set({ status: QUOTE_STATUS.REJECTED, updatedAt: new Date() })
    .where(and(eq(quotes.id, id), eq(quotes.orgId, session.org.id)));

  revalidatePath("/quotes");
  revalidatePath(`/quotes/${id}`);
  return { success: true };
}

export async function convertToInvoice(id: string) {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");

  const [quote] = await db
    .select()
    .from(quotes)
    .where(and(eq(quotes.id, id), eq(quotes.orgId, session.org.id)));

  if (!quote) return { success: false, error: "Quote not found" };
  if (quote.status !== QUOTE_STATUS.ACCEPTED) {
    return { success: false, error: "Only accepted quotes can be converted" };
  }

  const items = await db
    .select()
    .from(quoteItems)
    .where(eq(quoteItems.quoteId, id));

  // #132: quote → invoice conversion creates a DRAFT invoice — no
  // number is allocated until the user publishes/sends it.
  const [invoice] = await db
    .insert(invoices)
    .values({
      orgId: session.org.id,
      contactId: quote.contactId,
      invoiceNumber: null,
      issueDate: new Date().toISOString().split("T")[0],
      currencyCode: quote.currencyCode,
      exchangeRate: quote.exchangeRate,
      usesInclusiveTax: quote.usesInclusiveTax,
      subtotal: quote.subtotal,
      taxAmount: quote.taxAmount,
      total: quote.total,
      balance: quote.total,
      contactName: quote.contactName,
      contactEmail: quote.contactEmail,
      contactVatNumber: quote.contactVatNumber,
      contactAddress: quote.contactAddress,
      notes: quote.notes,
      terms: quote.terms,
      quoteId: quote.id,
    })
    .returning();

  for (const item of items) {
    await db.insert(invoiceItems).values({
      invoiceId: invoice.id,
      productId: item.productId,
      sortOrder: item.sortOrder,
      name: item.name,
      description: item.description,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      unit: item.unit,
      taxCategory: item.taxCategory,
      taxRate: item.taxRate,
      taxAmount: item.taxAmount,
      lineTotal: item.lineTotal,
    });
  }

  await db
    .update(quotes)
    .set({
      status: QUOTE_STATUS.CONVERTED,
      invoiceId: invoice.id,
      updatedAt: new Date(),
    })
    .where(and(eq(quotes.id, id), eq(quotes.orgId, session.org.id)));

  revalidatePath("/quotes");
  revalidatePath("/invoices");
  return { success: true, invoiceId: invoice.id };
}

export async function deleteQuote(id: string) {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");

  const [quote] = await db
    .select()
    .from(quotes)
    .where(and(eq(quotes.id, id), eq(quotes.orgId, session.org.id)));

  if (!quote) return { success: false, error: "Quote not found" };
  if (quote.status !== QUOTE_STATUS.DRAFT) {
    return { success: false, error: "Only draft quotes can be deleted" };
  }

  await db
    .delete(quotes)
    .where(and(eq(quotes.id, id), eq(quotes.orgId, session.org.id)));

  revalidatePath("/quotes");
  return { success: true };
}
