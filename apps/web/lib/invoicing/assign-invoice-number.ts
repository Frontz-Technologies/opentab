import { and, eq } from "drizzle-orm";
import { invoices, invoiceSequences } from "@opentab/db/schema";
import { db } from "@/lib/db";
import type { Db } from "@opentab/db";
import { formatInvoiceNumber } from "./numbering";

type Transaction = Parameters<Parameters<Db["transaction"]>[0]>[0];
type DbOrTx = Db | Transaction;

// Idempotent invoice-number reservation. Called from publishInvoice
// / sendInvoice / createInvoice(publish=true). Drafts do not hold a
// number until they transition out of DRAFT.
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
//
// Lives in a separate file (not numbering.ts) because numbering.ts
// has to stay client-bundlable — settings/numbering/numbering-form.tsx
// is a client component and imports `renderInvoiceNumberPattern` from
// numbering.ts. If `db` (and via it, the `postgres` driver's `fs` /
// `perf_hooks`) leak into numbering.ts, the client bundle breaks.
export async function assignInvoiceNumberIfMissing(
  invoiceId: string,
  orgId: string,
  dbInstance: DbOrTx = db,
): Promise<string> {
  // Ensure a sequence row exists. Single upsert against the unique
  // (orgId, type) index — a SELECT-then-INSERT pair would race when
  // two concurrent first-time publishes both took the INSERT branch.
  await dbInstance
    .insert(invoiceSequences)
    .values({ orgId, type: "invoice", prefix: "INV-" })
    .onConflictDoNothing({
      target: [invoiceSequences.orgId, invoiceSequences.type],
    });

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
      pattern: seq.pattern,
    });

    await tx
      .update(invoiceSequences)
      .set({ nextNumber: seq.nextNumber + 1 })
      .where(
        and(eq(invoiceSequences.id, seq.id), eq(invoiceSequences.orgId, orgId)),
      );

    await tx
      .update(invoices)
      .set({ invoiceNumber: number, updatedAt: new Date() })
      .where(and(eq(invoices.id, invoiceId), eq(invoices.orgId, orgId)));

    return number;
  });
}
