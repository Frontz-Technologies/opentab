"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { getSession } from "@/lib/session";
import { db } from "@/lib/db";
import {
  creditNotes,
  creditNoteItems,
  CREDIT_NOTE_STATUS,
  createCreditNoteSchema,
  updateCreditNoteSchema,
} from "@/lib/entities/credit-note";
import {
  ACTIVITY_TYPE,
  ENTITY_TYPE,
  activities,
} from "@/lib/entities/activity";
import { contacts } from "@opentab/db/schema";
import {
  calculateInvoiceTotals,
  calculateLineTotal,
} from "@/lib/invoicing/calculations";
import { assignCreditNoteNumberIfMissing } from "@/lib/invoicing/credit-note-numbering";
import { recordActivity } from "@/lib/activities/record";
import { submitCreditNoteThroughPlugins } from "@/lib/country/submit-credit-note";
import { createLogger } from "@/lib/logging/logger";

const log = createLogger("credit-notes");

export async function createCreditNote(formData: FormData) {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");

  const orgId = session.org.id;
  log.info("credit note creation started", { orgId });

  let rawItems: unknown;
  try {
    rawItems = JSON.parse((formData.get("items") as string) ?? "[]");
  } catch {
    return { success: false, error: { items: ["Invalid line items data"] } };
  }

  const parsed = createCreditNoteSchema.safeParse({
    contactId: formData.get("contactId"),
    invoiceId: formData.get("invoiceId") || undefined,
    issueDate: formData.get("issueDate"),
    currencyCode: formData.get("currencyCode") ?? "EUR",
    usesInclusiveTax: formData.get("usesInclusiveTax") === "true",
    contactName: formData.get("contactName"),
    contactEmail: formData.get("contactEmail") ?? "",
    contactVatNumber: formData.get("contactVatNumber") ?? "",
    contactAddress: formData.get("contactAddress") ?? "",
    reason: formData.get("reason"),
    reasonNote: formData.get("reasonNote") ?? "",
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

  const [contact] = await db
    .select()
    .from(contacts)
    .where(and(eq(contacts.id, data.contactId), eq(contacts.orgId, orgId)));
  if (!contact) {
    return { success: false, error: { contactId: ["Contact not found"] } };
  }

  // Header + N item rows in a single transaction (PR #211 lesson) so a
  // mid-loop failure (e.g. numeric overflow on an item) rolls back the
  // header and the user is not left with a half-built credit note.
  const creditNote = await db.transaction(async (tx) => {
    const [cn] = await tx
      .insert(creditNotes)
      .values({
        orgId,
        contactId: data.contactId,
        invoiceId: data.invoiceId || null,
        issueDate: data.issueDate,
        currencyCode: data.currencyCode,
        usesInclusiveTax: data.usesInclusiveTax,
        subtotal: totals.subtotal,
        taxAmount: totals.taxAmount,
        total: totals.total,
        contactName: data.contactName,
        contactEmail: data.contactEmail || null,
        contactVatNumber: data.contactVatNumber || null,
        contactAddress: data.contactAddress || null,
        reason: data.reason,
        reasonNote: data.reasonNote || null,
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
      await tx.insert(creditNoteItems).values({
        creditNoteId: cn.id,
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

    return cn;
  });

  await recordActivity({
    orgId,
    entityType: ENTITY_TYPE.CREDIT_NOTE,
    entityId: creditNote.id,
    userId: session.user.id,
    type: ACTIVITY_TYPE.CREDIT_NOTE_CREATED,
    payload: {
      status: CREDIT_NOTE_STATUS.DRAFT,
      total: creditNote.total,
      currency: creditNote.currencyCode,
      reason: data.reason,
      invoiceId: data.invoiceId || null,
    },
  });

  log.info("credit note created", {
    orgId,
    creditNoteId: creditNote.id,
    invoiceId: data.invoiceId || null,
  });

  revalidatePath("/credit-notes");
  return { success: true, creditNote };
}

export async function updateCreditNote(id: string, formData: FormData) {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");

  const orgId = session.org.id;

  const [existing] = await db
    .select()
    .from(creditNotes)
    .where(and(eq(creditNotes.id, id), eq(creditNotes.orgId, orgId)));
  if (!existing) {
    return { success: false, error: { _: ["Credit note not found"] } };
  }
  if (existing.status !== CREDIT_NOTE_STATUS.DRAFT) {
    return {
      success: false,
      error: { _: ["Only draft credit notes can be edited"] },
    };
  }

  let rawItems: unknown;
  try {
    rawItems = JSON.parse((formData.get("items") as string) ?? "[]");
  } catch {
    return { success: false, error: { items: ["Invalid line items data"] } };
  }
  const parsed = updateCreditNoteSchema.safeParse({
    contactId: formData.get("contactId"),
    invoiceId: formData.get("invoiceId") || undefined,
    issueDate: formData.get("issueDate"),
    currencyCode: formData.get("currencyCode") ?? "EUR",
    usesInclusiveTax: formData.get("usesInclusiveTax") === "true",
    contactName: formData.get("contactName"),
    contactEmail: formData.get("contactEmail") ?? "",
    contactVatNumber: formData.get("contactVatNumber") ?? "",
    contactAddress: formData.get("contactAddress") ?? "",
    reason: formData.get("reason"),
    reasonNote: formData.get("reasonNote") ?? "",
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

  // Wrap header update + delete-then-reinsert items in one transaction so a
  // mid-loop failure cannot leave the credit note with the old items deleted
  // and only a prefix of the new items inserted (PR #211 lesson, applied to
  // the edit path which is more dangerous than create — the deletion comes
  // BEFORE the inserts).
  await db.transaction(async (tx) => {
    await tx
      .update(creditNotes)
      .set({
        contactId: data.contactId,
        invoiceId: data.invoiceId || null,
        issueDate: data.issueDate,
        currencyCode: data.currencyCode,
        usesInclusiveTax: data.usesInclusiveTax,
        subtotal: totals.subtotal,
        taxAmount: totals.taxAmount,
        total: totals.total,
        contactName: data.contactName,
        contactEmail: data.contactEmail || null,
        contactVatNumber: data.contactVatNumber || null,
        contactAddress: data.contactAddress || null,
        reason: data.reason,
        reasonNote: data.reasonNote || null,
        notes: data.notes || null,
        terms: data.terms || null,
        updatedAt: new Date(),
      })
      .where(eq(creditNotes.id, id));

    await tx
      .delete(creditNoteItems)
      .where(eq(creditNoteItems.creditNoteId, id));
    for (const item of data.items) {
      const lineTotals = calculateLineTotal({
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        taxRate: item.taxRate,
        usesInclusiveTax: data.usesInclusiveTax,
      });
      await tx.insert(creditNoteItems).values({
        creditNoteId: id,
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
  });

  revalidatePath("/credit-notes");
  revalidatePath(`/credit-notes/${id}`);
  return { success: true };
}

export async function publishCreditNote(id: string) {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");

  const orgId = session.org.id;
  const [cn] = await db
    .select()
    .from(creditNotes)
    .where(and(eq(creditNotes.id, id), eq(creditNotes.orgId, orgId)));
  if (!cn) return { success: false, error: "Credit note not found" };
  if (cn.status !== CREDIT_NOTE_STATUS.DRAFT) {
    return {
      success: false,
      error: "Only draft credit notes can be published",
    };
  }

  await db.transaction(async (tx) => {
    await tx
      .update(creditNotes)
      .set({
        status: CREDIT_NOTE_STATUS.PUBLISHED,
        updatedAt: new Date(),
      })
      .where(eq(creditNotes.id, id));
    await assignCreditNoteNumberIfMissing(id, orgId, tx);
  });

  await recordActivity({
    orgId,
    entityType: ENTITY_TYPE.CREDIT_NOTE,
    entityId: id,
    userId: session.user.id,
    type: ACTIVITY_TYPE.CREDIT_NOTE_PUBLISHED,
    payload: {
      from: CREDIT_NOTE_STATUS.DRAFT,
      to: CREDIT_NOTE_STATUS.PUBLISHED,
    },
  });

  revalidatePath("/credit-notes");
  revalidatePath(`/credit-notes/${id}`);
  return { success: true };
}

export async function sendCreditNote(id: string) {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");

  const orgId = session.org.id;
  const [cn] = await db
    .select()
    .from(creditNotes)
    .where(and(eq(creditNotes.id, id), eq(creditNotes.orgId, orgId)));
  if (!cn) return { success: false, error: "Credit note not found" };
  if (
    cn.status !== CREDIT_NOTE_STATUS.DRAFT &&
    cn.status !== CREDIT_NOTE_STATUS.PUBLISHED
  ) {
    return {
      success: false,
      error: "Only draft or published credit notes can be sent",
    };
  }

  await db.transaction(async (tx) => {
    await tx
      .update(creditNotes)
      .set({
        status: CREDIT_NOTE_STATUS.SENT,
        sentAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(creditNotes.id, id));
    await assignCreditNoteNumberIfMissing(id, orgId, tx);
  });

  await recordActivity({
    orgId,
    entityType: ENTITY_TYPE.CREDIT_NOTE,
    entityId: id,
    userId: session.user.id,
    type: ACTIVITY_TYPE.CREDIT_NOTE_SENT,
    payload: {
      from: cn.status,
      to: CREDIT_NOTE_STATUS.SENT,
      recipientEmail: cn.contactEmail ?? null,
    },
  });

  await submitCreditNoteThroughPlugins(
    id,
    {
      id: orgId,
      taxId: session.org.taxId ?? null,
      countryCode: session.org.countryCode ?? null,
    },
    session.user.id,
  );

  revalidatePath("/credit-notes");
  revalidatePath(`/credit-notes/${id}`);
  return { success: true };
}

export async function cancelCreditNote(id: string) {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");

  const orgId = session.org.id;
  const [cn] = await db
    .select()
    .from(creditNotes)
    .where(and(eq(creditNotes.id, id), eq(creditNotes.orgId, orgId)));
  if (!cn) return { success: false, error: "Credit note not found" };
  if (cn.status === CREDIT_NOTE_STATUS.CANCELLED) {
    return { success: false, error: "Already cancelled" };
  }

  await db
    .update(creditNotes)
    .set({ status: CREDIT_NOTE_STATUS.CANCELLED, updatedAt: new Date() })
    .where(eq(creditNotes.id, id));

  await recordActivity({
    orgId,
    entityType: ENTITY_TYPE.CREDIT_NOTE,
    entityId: id,
    userId: session.user.id,
    type: ACTIVITY_TYPE.CREDIT_NOTE_CANCELLED,
    payload: { from: cn.status, to: CREDIT_NOTE_STATUS.CANCELLED },
  });

  revalidatePath("/credit-notes");
  revalidatePath(`/credit-notes/${id}`);
  return { success: true };
}

export async function deleteCreditNote(id: string) {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");

  const orgId = session.org.id;
  const [cn] = await db
    .select()
    .from(creditNotes)
    .where(and(eq(creditNotes.id, id), eq(creditNotes.orgId, orgId)));
  if (!cn) return { success: false, error: "Credit note not found" };
  if (cn.status !== CREDIT_NOTE_STATUS.DRAFT) {
    return {
      success: false,
      error: "Only draft credit notes can be deleted",
    };
  }

  // Activities-cascade + invoice-delete in one transaction (per the
  // PR #211 lesson). Tombstone activity outside the tx, best-effort.
  await db.transaction(async (tx) => {
    await tx
      .delete(activities)
      .where(
        and(
          eq(activities.entityType, ENTITY_TYPE.CREDIT_NOTE),
          eq(activities.entityId, id),
        ),
      );
    await tx.delete(creditNotes).where(eq(creditNotes.id, id));
  });

  await recordActivity({
    orgId,
    entityType: ENTITY_TYPE.CREDIT_NOTE,
    entityId: id,
    userId: session.user.id,
    type: ACTIVITY_TYPE.CREDIT_NOTE_DELETED,
    payload: { status: cn.status },
  });

  revalidatePath("/credit-notes");
  return { success: true };
}
