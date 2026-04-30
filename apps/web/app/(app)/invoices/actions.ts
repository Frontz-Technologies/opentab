"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/session";
import {
  invoices,
  invoiceItems,
  INVOICE_STATUS,
  createInvoiceSchema,
  updateInvoiceSchema,
} from "@/lib/entities/invoice";
import {
  submitInvoiceThroughPlugins,
  cancelInvoiceOnPlugins,
} from "@/lib/country/submit-invoice";
import { eq, and } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  calculateLineTotal,
  calculateInvoiceTotals,
} from "@/lib/invoicing/calculations";
import { createDraftInvoice } from "@/lib/invoicing/draft-invoices";
import { assignInvoiceNumberIfMissing } from "@/lib/invoicing/assign-invoice-number";
import { getFxRate } from "@/lib/fx/get-rate";
import {
  isSupportedCurrency,
  type SupportedCurrencyCode,
} from "@/lib/currency/supported";
import { createLogger } from "@/lib/logging/logger";
import { recordActivity } from "@/lib/activities/record";
import {
  ACTIVITY_TYPE,
  ENTITY_TYPE,
  activities,
} from "@/lib/entities/activity";

const log = createLogger("invoices");

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

  const parsed = createInvoiceSchema.safeParse({
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
  // If publish flag is set, immediately transition to PUBLISHED and
  // assign the invoice number (#132 — drafts hold no number).
  // Wrapped in a transaction (tester finding on PR #212): if the
  // number-assign throws, the status flip is rolled back so the
  // invoice never appears as PUBLISHED with `invoice_number = null`.
  let assignedNumber: string | null = null;
  if (publish) {
    assignedNumber = await db.transaction(async (tx) => {
      await tx
        .update(invoices)
        .set({ status: INVOICE_STATUS.PUBLISHED, updatedAt: new Date() })
        .where(eq(invoices.id, invoice.id));
      return assignInvoiceNumberIfMissing(invoice.id, orgId, tx);
    });
  }

  log.info("invoice created", {
    orgId,
    invoiceId: invoice.id,
    published: publish,
    itemCount: parsed.data.items.length,
  });

  await recordActivity({
    orgId,
    entityType: ENTITY_TYPE.INVOICE,
    entityId: invoice.id,
    userId: session.user.id,
    type: ACTIVITY_TYPE.INVOICE_CREATED,
    payload: {
      status: publish ? INVOICE_STATUS.PUBLISHED : INVOICE_STATUS.DRAFT,
      total: invoice.total,
      currency: invoice.currencyCode,
    },
  });
  if (publish) {
    await recordActivity({
      orgId,
      entityType: ENTITY_TYPE.INVOICE,
      entityId: invoice.id,
      userId: session.user.id,
      type: ACTIVITY_TYPE.INVOICE_PUBLISHED,
      payload: { from: INVOICE_STATUS.DRAFT, to: INVOICE_STATUS.PUBLISHED },
    });
  }

  revalidatePath("/invoices");
  return {
    success: true,
    invoice: {
      ...invoice,
      invoiceNumber: assignedNumber ?? invoice.invoiceNumber,
    },
  };
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

  const parsed = updateInvoiceSchema.safeParse({
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
    .update(invoices)
    .set({
      contactId: data.contactId,
      issueDate: data.issueDate,
      dueDate: data.dueDate || null,
      currencyCode: data.currencyCode,
      exchangeRate: nextExchangeRate,
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

  await recordActivity({
    orgId,
    entityType: ENTITY_TYPE.INVOICE,
    entityId: id,
    userId: session.user.id,
    type: ACTIVITY_TYPE.INVOICE_UPDATED,
    payload: { itemCount: data.items.length, total: totals.total },
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

  // #132 + tester finding on PR #212: status flip + number assignment
  // run in a single transaction. If the helper throws, the SENT
  // transition is rolled back so the invoice never appears as SENT
  // with `invoice_number = null`. Helper is idempotent — no-op if
  // the number is already set (e.g. previously published before send).
  await db.transaction(async (tx) => {
    await tx
      .update(invoices)
      .set({
        status: INVOICE_STATUS.SENT,
        sentAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(invoices.id, id));
    await assignInvoiceNumberIfMissing(id, orgId, tx);
  });

  // Submit through the country plugin integrations (non-blocking)
  const submissionResults = await submitInvoiceThroughPlugins(
    id,
    {
      id: session.org.id,
      taxId: session.org.taxId,
      countryCode: session.org.countryCode,
    },
    session.user.id,
  );
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

  await recordActivity({
    orgId,
    entityType: ENTITY_TYPE.INVOICE,
    entityId: id,
    userId: session.user.id,
    type: ACTIVITY_TYPE.INVOICE_SENT,
    payload: {
      from: invoice.status,
      to: INVOICE_STATUS.SENT,
      recipientEmail: invoice.contactEmail ?? null,
    },
  });

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

  // #132 + tester finding on PR #212: status flip + number assignment
  // run in a single transaction. If the helper throws, the PUBLISHED
  // transition is rolled back so the invoice never appears as
  // PUBLISHED with `invoice_number = null`.
  await db.transaction(async (tx) => {
    await tx
      .update(invoices)
      .set({
        status: INVOICE_STATUS.PUBLISHED,
        updatedAt: new Date(),
      })
      .where(eq(invoices.id, id));
    await assignInvoiceNumberIfMissing(id, orgId, tx);
  });

  log.info("invoice published", { orgId, invoiceId: id });

  await recordActivity({
    orgId,
    entityType: ENTITY_TYPE.INVOICE,
    entityId: id,
    userId: session.user.id,
    type: ACTIVITY_TYPE.INVOICE_PUBLISHED,
    payload: { from: INVOICE_STATUS.DRAFT, to: INVOICE_STATUS.PUBLISHED },
  });

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

  await recordActivity({
    orgId,
    entityType: ENTITY_TYPE.INVOICE,
    entityId: id,
    userId: session.user.id,
    type: ACTIVITY_TYPE.INVOICE_PAID,
    payload: {
      from: invoice.status,
      to: INVOICE_STATUS.PAID,
      amount: invoice.total,
      currency: invoice.currencyCode,
    },
  });

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

  await recordActivity({
    orgId,
    entityType: ENTITY_TYPE.INVOICE,
    entityId: id,
    userId: session.user.id,
    type: ACTIVITY_TYPE.INVOICE_CANCELLED,
    payload: { from: invoice.status, to: INVOICE_STATUS.CANCELLED },
  });

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

  // App-layer cascade in a single transaction (tester finding on
  // PR #211): without the transaction, an invoice-delete failure
  // after a successful activities-delete leaves the invoice live but
  // its audit history gone. The transaction either commits both or
  // rolls back both. The tombstone `recordActivity` call below stays
  // best-effort outside the transaction — it shouldn't gate the
  // user's delete on the audit table being healthy.
  await db.transaction(async (tx) => {
    await tx
      .delete(activities)
      .where(
        and(
          eq(activities.entityType, ENTITY_TYPE.INVOICE),
          eq(activities.entityId, id),
        ),
      );
    await tx
      .delete(invoices)
      .where(and(eq(invoices.id, id), eq(invoices.orgId, session.org.id)));
  });

  log.info("invoice deleted", { orgId, invoiceId: id });

  // Note: we record the deletion AFTER the row is gone. The activity
  // is still meaningful — it tells the audit reader "the invoice was
  // deleted", with the snapshotted status in the payload — but it
  // will become orphaned the next time someone deletes activities for
  // this invoiceId. That's acceptable for a deleted draft.
  await recordActivity({
    orgId,
    entityType: ENTITY_TYPE.INVOICE,
    entityId: id,
    userId: session.user.id,
    type: ACTIVITY_TYPE.INVOICE_DELETED,
    payload: { status: invoice.status },
  });

  revalidatePath("/invoices");
  return { success: true };
}
