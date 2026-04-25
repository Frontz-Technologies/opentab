import { and, eq } from "drizzle-orm";
import { creditNotes, invoiceSequences } from "@opentab/db/schema";
import { db } from "@/lib/db";
import { formatInvoiceNumber } from "@/lib/invoicing/numbering";

// Idempotent credit-note number reservation (#133). Mirrors the
// invoice helper from #132 — same FOR UPDATE semantics, different
// table + sequence row keyed on type='credit_note'.
//
// Race-safety:
//   - Same credit note, two concurrent publishes: the FOR UPDATE on
//     the credit_note row blocks the second; when the second wakes,
//     it re-reads credit_note_number, sees it's no longer null, and
//     returns the existing value without consuming a sequence slot.
//   - Different credit notes, concurrent publishes: the FOR UPDATE
//     on the invoiceSequences row serialises them — each gets a
//     sequential number, no skips, no collisions.
//
// dbInstance is parameterised so unit tests can pass a PGlite db.
export async function assignCreditNoteNumberIfMissing(
  creditNoteId: string,
  orgId: string,
  dbInstance: typeof db = db,
): Promise<string> {
  // Ensure a sequence row exists. Outside the transaction so a
  // pre-existing sequence + new credit note path stays single-statement.
  const [existingSeq] = await dbInstance
    .select()
    .from(invoiceSequences)
    .where(
      and(
        eq(invoiceSequences.orgId, orgId),
        eq(invoiceSequences.type, "credit_note"),
      ),
    );
  if (!existingSeq) {
    await dbInstance
      .insert(invoiceSequences)
      .values({ orgId, type: "credit_note", prefix: "CN-" });
  }

  return await dbInstance.transaction(async (tx) => {
    const [row] = await tx
      .select({ creditNoteNumber: creditNotes.creditNoteNumber })
      .from(creditNotes)
      .where(and(eq(creditNotes.id, creditNoteId), eq(creditNotes.orgId, orgId)))
      .for("update");

    if (!row) {
      throw new Error(
        `assignCreditNoteNumberIfMissing: credit note ${creditNoteId} not found in org ${orgId}`,
      );
    }
    if (row.creditNoteNumber !== null) {
      return row.creditNoteNumber;
    }

    const [seq] = await tx
      .select()
      .from(invoiceSequences)
      .where(
        and(
          eq(invoiceSequences.orgId, orgId),
          eq(invoiceSequences.type, "credit_note"),
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

    await tx
      .update(creditNotes)
      .set({ creditNoteNumber: number, updatedAt: new Date() })
      .where(eq(creditNotes.id, creditNoteId));

    return number;
  });
}
