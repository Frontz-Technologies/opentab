"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/session";
import {
  invoices,
  invoiceItems,
  invoiceSequences,
  INVOICE_STATUS,
} from "@opentab/db/schema";
import {
  submitInvoiceThroughPlugins,
  cancelInvoiceOnPlugins,
} from "@/lib/country/submit-invoice";
import { eq, and } from "drizzle-orm";
import { db } from "@/lib/db";
import { z } from "zod";
import { formatInvoiceNumber } from "@/lib/invoicing/numbering";
import {
  calculateLineTotal,
  calculateInvoiceTotals,
} from "@/lib/invoicing/calculations";
import { createDraftInvoice } from "@/lib/invoicing/draft-invoices";
import { createLogger } from "@/lib/logging/logger";

const log = createLogger("invoices");

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

const invoiceSchema = z.object({
  contactId: z.string().uuid(),
  issueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  dueDate: z
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
  internalNotes: z.string().optional().default(""),
  items: z.array(lineItemSchema).min(1, "At least one line item is required"),
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
    .values({
      orgId,
      type,
      prefix: defaults[type] ?? "INV-",
    })
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
    });

    await tx
      .update(invoiceSequences)
      .set({ nextNumber: seq.nextNumber + 1 })
      .where(eq(invoiceSequences.id, seq.id));

    return number;
  });
}

export async function createInvoice(formData: FormData) {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");

  const orgId = session.org.id;
  log.info("invoice creation started", { orgId });

  let rawItems: unknown;
  try {
    rawItems = JSON.parse((formData.get("items") as string) ?? "[]");
  } catch {
    log.warn("invalid line items JSON", { orgId });
    return { success: false, error: { items: ["Invalid line items data"] } };
  }

  const parsed = invoiceSchema.safeParse({
    contactId: formData.get("contactId"),
    issueDate: formData.get("issueDate"),
    dueDate: formData.get("dueDate") || undefined,
    currencyCode: formData.get("currencyCode") ?? "EUR",
    usesInclusiveTax: formData.get("usesInclusiveTax") === "true",
    contactName: formData.get("contactName"),
    contactEmail: formData.get("contactEmail") ?? "",
    contactVatNumber: formData.get("contactVatNumber") ?? "",
    contactAddress: formData.get("contactAddress") ?? "",
    notes: formData.get("notes") ?? "",
    terms: formData.get("terms") ?? "",
    internalNotes: formData.get("internalNotes") ?? "",
    items: rawItems,
  });

  if (!parsed.success) {
    log.warn("invoice validation failed", { orgId });
    return { success: false, error: parsed.error.flatten().fieldErrors };
  }

  const { invoice } = await createDraftInvoice(session.org.id, parsed.data);

  const publish = formData.get("publish") === "true";
  // If publish flag is set, immediately transition to PUBLISHED
  if (publish) {
    await db
      .update(invoices)
      .set({ status: INVOICE_STATUS.PUBLISHED, updatedAt: new Date() })
      .where(eq(invoices.id, invoice.id));
  }

  log.info("invoice created", {
    orgId,
    invoiceId: invoice.id,
    published: publish,
    itemCount: parsed.data.items.length,
  });

  revalidatePath("/invoices");
  return { success: true, invoice };
}

export async function updateInvoice(id: string, formData: FormData) {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");

  const orgId = session.org.id;
  log.info("invoice update started", { orgId, invoiceId: id });

  const [existing] = await db
    .select()
    .from(invoices)
    .where(and(eq(invoices.id, id), eq(invoices.orgId, session.org.id)));

  if (!existing) {
    log.warn("invoice not found for update", { orgId, invoiceId: id });
    return { success: false, error: { _: ["Invoice not found"] } };
  }
  if (existing.status !== INVOICE_STATUS.DRAFT) {
    log.warn("attempted update on non-draft invoice", {
      orgId,
      invoiceId: id,
      status: existing.status,
    });
    return {
      success: false,
      error: { _: ["Only draft invoices can be edited"] },
    };
  }

  let rawItems: unknown;
  try {
    rawItems = JSON.parse((formData.get("items") as string) ?? "[]");
  } catch {
    log.warn("invalid line items JSON", { orgId, invoiceId: id });
    return { success: false, error: { items: ["Invalid line items data"] } };
  }

  const parsed = invoiceSchema.safeParse({
    contactId: formData.get("contactId"),
    issueDate: formData.get("issueDate"),
    dueDate: formData.get("dueDate") || undefined,
    currencyCode: formData.get("currencyCode") ?? "EUR",
    usesInclusiveTax: formData.get("usesInclusiveTax") === "true",
    contactName: formData.get("contactName"),
    contactEmail: formData.get("contactEmail") ?? "",
    contactVatNumber: formData.get("contactVatNumber") ?? "",
    contactAddress: formData.get("contactAddress") ?? "",
    notes: formData.get("notes") ?? "",
    terms: formData.get("terms") ?? "",
    internalNotes: formData.get("internalNotes") ?? "",
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
    .update(invoices)
    .set({
      contactId: data.contactId,
      issueDate: data.issueDate,
      dueDate: data.dueDate || null,
      currencyCode: data.currencyCode,
      usesInclusiveTax,
      subtotal: totals.subtotal,
      taxAmount: totals.taxAmount,
      total: totals.total,
      balance: totals.total,
      contactName: data.contactName,
      contactEmail: data.contactEmail || null,
      contactVatNumber: data.contactVatNumber || null,
      contactAddress: data.contactAddress || null,
      notes: data.notes || null,
      terms: data.terms || null,
      internalNotes: data.internalNotes || null,
      updatedAt: new Date(),
    })
    .where(and(eq(invoices.id, id), eq(invoices.orgId, session.org.id)));

  // Replace all line items
  await db.delete(invoiceItems).where(eq(invoiceItems.invoiceId, id));

  for (const item of data.items) {
    const lineTotals = calculateLineTotal({
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      taxRate: item.taxRate,
      usesInclusiveTax,
    });

    await db.insert(invoiceItems).values({
      invoiceId: id,
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

  log.info("invoice updated", {
    orgId,
    invoiceId: id,
    itemCount: data.items.length,
  });

  revalidatePath("/invoices");
  revalidatePath(`/invoices/${id}`);
  return { success: true };
}

export async function sendInvoice(id: string) {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");

  const orgId = session.org.id;
  log.info("invoice send started", { orgId, invoiceId: id });

  const [invoice] = await db
    .select()
    .from(invoices)
    .where(and(eq(invoices.id, id), eq(invoices.orgId, session.org.id)));

  if (!invoice) {
    log.warn("invoice not found for send", { orgId, invoiceId: id });
    return { success: false, error: "Invoice not found" };
  }
  if (
    invoice.status !== INVOICE_STATUS.DRAFT &&
    invoice.status !== INVOICE_STATUS.PUBLISHED
  ) {
    log.warn("attempted send on invalid status", {
      orgId,
      invoiceId: id,
      status: invoice.status,
    });
    return {
      success: false,
      error: "Only draft or published invoices can be sent",
    };
  }

  await db
    .update(invoices)
    .set({
      status: INVOICE_STATUS.SENT,
      sentAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(invoices.id, id));

  // Submit through the country plugin integrations (non-blocking)
  const submissionResults = await submitInvoiceThroughPlugins(id, {
    id: session.org.id,
    taxId: session.org.taxId,
    countryCode: session.org.countryCode,
  });
  for (const r of submissionResults) {
    if (!r.ok) {
      log.error("integration submission failed", {
        orgId,
        invoiceId: id,
        kind: r.kind,
        error: r.error ?? "unknown",
      });
    } else {
      log.info("integration submission ok", {
        orgId,
        invoiceId: id,
        kind: r.kind,
        externalId: r.externalId,
      });
    }
  }

  log.info("invoice sent", { orgId, invoiceId: id });

  revalidatePath("/invoices");
  revalidatePath(`/invoices/${id}`);
  return { success: true };
}

export async function publishInvoice(id: string) {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");

  const orgId = session.org.id;

  const [invoice] = await db
    .select()
    .from(invoices)
    .where(and(eq(invoices.id, id), eq(invoices.orgId, session.org.id)));

  if (!invoice) {
    log.warn("invoice not found for publish", { orgId, invoiceId: id });
    return { success: false, error: "Invoice not found" };
  }
  if (invoice.status !== INVOICE_STATUS.DRAFT) {
    log.warn("attempted publish on non-draft invoice", {
      orgId,
      invoiceId: id,
      status: invoice.status,
    });
    return { success: false, error: "Only draft invoices can be published" };
  }

  await db
    .update(invoices)
    .set({
      status: INVOICE_STATUS.PUBLISHED,
      updatedAt: new Date(),
    })
    .where(eq(invoices.id, id));

  log.info("invoice published", { orgId, invoiceId: id });

  revalidatePath("/invoices");
  revalidatePath(`/invoices/${id}`);
  return { success: true };
}

export async function markAsPaid(id: string) {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");

  const orgId = session.org.id;

  const [invoice] = await db
    .select()
    .from(invoices)
    .where(and(eq(invoices.id, id), eq(invoices.orgId, session.org.id)));

  if (!invoice) {
    log.warn("invoice not found for mark-as-paid", { orgId, invoiceId: id });
    return { success: false, error: "Invoice not found" };
  }
  if (
    invoice.status !== INVOICE_STATUS.SENT &&
    invoice.status !== INVOICE_STATUS.PARTIAL
  ) {
    log.warn("attempted mark-as-paid on invalid status", {
      orgId,
      invoiceId: id,
      status: invoice.status,
    });
    return {
      success: false,
      error: "Only sent or partial invoices can be marked as paid",
    };
  }

  await db
    .update(invoices)
    .set({
      status: INVOICE_STATUS.PAID,
      amountPaid: invoice.total,
      balance: "0.00",
      paidAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(invoices.id, id));

  log.info("invoice marked as paid", { orgId, invoiceId: id });

  revalidatePath("/invoices");
  revalidatePath(`/invoices/${id}`);
  return { success: true };
}

export async function cancelInvoice(id: string) {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");

  const orgId = session.org.id;

  const [invoice] = await db
    .select()
    .from(invoices)
    .where(and(eq(invoices.id, id), eq(invoices.orgId, session.org.id)));

  if (!invoice) {
    log.warn("invoice not found for cancel", { orgId, invoiceId: id });
    return { success: false, error: "Invoice not found" };
  }
  if (invoice.status === INVOICE_STATUS.PAID) {
    log.warn("attempted cancel on paid invoice", { orgId, invoiceId: id });
    return { success: false, error: "Paid invoices cannot be cancelled" };
  }

  await db
    .update(invoices)
    .set({
      status: INVOICE_STATUS.CANCELLED,
      updatedAt: new Date(),
    })
    .where(eq(invoices.id, id));

  const cancellations = await cancelInvoiceOnPlugins(id, {
    id: session.org.id,
    taxId: session.org.taxId,
    countryCode: session.org.countryCode,
  });
  for (const r of cancellations) {
    if (!r.ok) {
      log.error("integration cancellation failed", {
        orgId,
        invoiceId: id,
        kind: r.kind,
        error: r.error ?? "unknown",
      });
    }
  }

  log.info("invoice cancelled", { orgId, invoiceId: id });

  revalidatePath("/invoices");
  revalidatePath(`/invoices/${id}`);
  return { success: true };
}

export async function deleteInvoice(id: string) {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");

  const orgId = session.org.id;

  const [invoice] = await db
    .select()
    .from(invoices)
    .where(and(eq(invoices.id, id), eq(invoices.orgId, session.org.id)));

  if (!invoice) {
    log.warn("invoice not found for delete", { orgId, invoiceId: id });
    return { success: false, error: "Invoice not found" };
  }
  if (invoice.status !== INVOICE_STATUS.DRAFT) {
    log.warn("attempted delete on non-draft invoice", {
      orgId,
      invoiceId: id,
      status: invoice.status,
    });
    return { success: false, error: "Only draft invoices can be deleted" };
  }

  await db
    .delete(invoices)
    .where(and(eq(invoices.id, id), eq(invoices.orgId, session.org.id)));

  log.info("invoice deleted", { orgId, invoiceId: id });

  revalidatePath("/invoices");
  return { success: true };
}
