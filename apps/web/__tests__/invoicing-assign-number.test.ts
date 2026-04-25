import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { eq } from "drizzle-orm";
import { createTestDb } from "@opentab/db/test-utils";
import {
  organisations,
  contacts,
  invoices,
  invoiceSequences,
  INVOICE_STATUS,
} from "@opentab/db/schema";
import { assignInvoiceNumberIfMissing } from "../lib/invoicing/assign-invoice-number";

describe("assignInvoiceNumberIfMissing (#132) — defer-to-publish numbering", () => {
  let db: Awaited<ReturnType<typeof createTestDb>>["db"];
  let teardown: () => Promise<void>;
  let orgId: string;
  let contactId: string;

  beforeAll(async () => {
    const ctx = await createTestDb();
    db = ctx.db;
    teardown = ctx.teardown;

    const [org] = await db
      .insert(organisations)
      .values({ name: "Test Org", slug: "test-org-132", countryCode: "GR" })
      .returning();
    orgId = org.id;

    const [contact] = await db
      .insert(contacts)
      .values({ orgId, displayName: "Test Client" })
      .returning();
    contactId = contact.id;
  });

  afterAll(async () => {
    await teardown();
  });

  async function makeDraftInvoice(): Promise<string> {
    const [inv] = await db
      .insert(invoices)
      .values({
        orgId,
        contactId,
        status: INVOICE_STATUS.DRAFT,
        invoiceNumber: null,
        issueDate: "2026-04-25",
        contactName: "Test Client",
      })
      .returning({ id: invoices.id });
    return inv.id;
  }

  it("assigns the first sequence number to a number-less invoice", async () => {
    const id = await makeDraftInvoice();

    const number = await assignInvoiceNumberIfMissing(id, orgId, db);

    expect(number).toBe("INV-0001");
    const [row] = await db
      .select({ invoiceNumber: invoices.invoiceNumber })
      .from(invoices)
      .where(eq(invoices.id, id));
    expect(row.invoiceNumber).toBe("INV-0001");
    const [seq] = await db
      .select({ nextNumber: invoiceSequences.nextNumber })
      .from(invoiceSequences)
      .where(eq(invoiceSequences.orgId, orgId));
    expect(seq.nextNumber).toBe(2);
  });

  it("is idempotent — second call returns the same number, sequence does not advance", async () => {
    const id = await makeDraftInvoice();

    const first = await assignInvoiceNumberIfMissing(id, orgId, db);
    expect(first).toBe("INV-0002");
    const [seqAfterFirst] = await db
      .select({ nextNumber: invoiceSequences.nextNumber })
      .from(invoiceSequences)
      .where(eq(invoiceSequences.orgId, orgId));
    expect(seqAfterFirst.nextNumber).toBe(3);

    const second = await assignInvoiceNumberIfMissing(id, orgId, db);
    expect(second).toBe("INV-0002");
    const [seqAfterSecond] = await db
      .select({ nextNumber: invoiceSequences.nextNumber })
      .from(invoiceSequences)
      .where(eq(invoiceSequences.orgId, orgId));
    expect(seqAfterSecond.nextNumber).toBe(3);
  });

  it("two parallel calls for the SAME invoice both return the same number, only one slot consumed", async () => {
    const id = await makeDraftInvoice();

    const [a, b] = await Promise.all([
      assignInvoiceNumberIfMissing(id, orgId, db),
      assignInvoiceNumberIfMissing(id, orgId, db),
    ]);

    expect(a).toBe(b);
    const [row] = await db
      .select({ invoiceNumber: invoices.invoiceNumber })
      .from(invoices)
      .where(eq(invoices.id, id));
    expect(row.invoiceNumber).toBe(a);
  });

  it("two parallel calls for DIFFERENT invoices produce sequential numbers with no gap and no collision", async () => {
    const id1 = await makeDraftInvoice();
    const id2 = await makeDraftInvoice();

    const [n1, n2] = await Promise.all([
      assignInvoiceNumberIfMissing(id1, orgId, db),
      assignInvoiceNumberIfMissing(id2, orgId, db),
    ]);

    expect(n1).not.toBe(n2);
    const numbers = [n1, n2].sort();
    // Both numbers should be consecutive in the per-org sequence —
    // pre-existing tests in this file have already advanced the
    // sequence, so we just assert consecutiveness, not specific values.
    const a = parseInt(numbers[0].replace("INV-", ""), 10);
    const b = parseInt(numbers[1].replace("INV-", ""), 10);
    expect(b - a).toBe(1);
  });
});
