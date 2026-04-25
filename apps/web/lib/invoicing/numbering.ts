import { and, eq } from "drizzle-orm";
import { invoices, invoiceSequences } from "@opentab/db/schema";
import { db } from "@/lib/db";

type Database = typeof db;
type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
type DbOrTx = Database | Transaction;

export interface NumberFormatOptions {
  prefix: string;
  nextNumber: number;
  digitCount: number;
  includeYear: boolean;
  year?: number;
}

export function formatInvoiceNumber(opts: NumberFormatOptions): string {
  const padded = String(opts.nextNumber).padStart(opts.digitCount, "0");

  if (opts.includeYear) {
    const year = opts.year ?? new Date().getFullYear();
    return `${opts.prefix}${year}-${padded}`;
  }

  return `${opts.prefix}${padded}`;
}

// Idempotent invoice-number reservation (#132). Called from
// publishInvoice / sendInvoice / createInvoice(publish=true). Drafts
// no longer hold a number until they transition out of DRAFT.
//
// Race-safety:
//   - Same invoice, two concurrent publishes: the FOR UPDATE on the
//     invoice row blocks the second; when the second wakes, it
//     re-reads invoice_number, sees it's no longer null, and returns
//     the existing value without consuming a sequence slot.
//   - Different invoices, concurrent publishes: the FOR UPDATE on
//     the invoiceSequences row serialises them — each gets a
//     sequential number, no skips, no collisions.
//
// dbInstance is parameterised so unit tests can pass a PGlite db.
export async function assignInvoiceNumberIfMissing(
  invoiceId: string,
  orgId: string,
  dbInstance: DbOrTx = db,
): Promise<string> {
  // Ensure a sequence row exists. Outside the transaction so a
  // pre-existing sequence + new invoice path stays single-statement.
  const [existingSeq] = await dbInstance
    .select()
    .from(invoiceSequences)
    .where(
      and(
        eq(invoiceSequences.orgId, orgId),
        eq(invoiceSequences.type, "invoice"),
      ),
    );
  if (!existingSeq) {
    await dbInstance
      .insert(invoiceSequences)
      .values({ orgId, type: "invoice", prefix: "INV-" });
  }

  return await dbInstance.transaction(async (tx) => {
    // Lock the invoice row first so two concurrent calls for the same
    // invoice serialise here — the second's re-read sees the number
    // is already assigned and short-circuits.
    const [invoiceRow] = await tx
      .select({
        invoiceNumber: invoices.invoiceNumber,
      })
      .from(invoices)
      .where(and(eq(invoices.id, invoiceId), eq(invoices.orgId, orgId)))
      .for("update");

    if (!invoiceRow) {
      throw new Error(
        `assignInvoiceNumberIfMissing: invoice ${invoiceId} not found in org ${orgId}`,
      );
    }
    if (invoiceRow.invoiceNumber !== null) {
      return invoiceRow.invoiceNumber;
    }

    // Allocate the next sequence value under FOR UPDATE — serialises
    // concurrent allocations across different invoices.
    const [seq] = await tx
      .select()
      .from(invoiceSequences)
      .where(
        and(
          eq(invoiceSequences.orgId, orgId),
          eq(invoiceSequences.type, "invoice"),
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
      .update(invoices)
      .set({ invoiceNumber: number, updatedAt: new Date() })
      .where(eq(invoices.id, invoiceId));

    return number;
  });
}
