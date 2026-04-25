import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { eq } from "drizzle-orm";
import { createTestDb } from "@opentab/db/test-utils";
import {
  organisations,
  contacts,
  creditNotes,
  invoiceSequences,
  CREDIT_NOTE_STATUS,
  CREDIT_NOTE_REASON,
} from "@opentab/db/schema";
import { assignCreditNoteNumberIfMissing } from "../lib/invoicing/credit-note-numbering";

describe("assignCreditNoteNumberIfMissing (#133)", () => {
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
      .values({ name: "Test Org", slug: "test-org-133", countryCode: "GR" })
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

  async function makeDraftCreditNote(): Promise<string> {
    const [cn] = await db
      .insert(creditNotes)
      .values({
        orgId,
        contactId,
        status: CREDIT_NOTE_STATUS.DRAFT,
        creditNoteNumber: null,
        issueDate: "2026-04-25",
        contactName: "Test Client",
        reason: CREDIT_NOTE_REASON.RETURN,
      })
      .returning({ id: creditNotes.id });
    return cn.id;
  }

  it("assigns the first sequence number to a number-less credit note", async () => {
    const id = await makeDraftCreditNote();

    const number = await assignCreditNoteNumberIfMissing(id, orgId, db);

    expect(number).toBe("CN-0001");
    const [row] = await db
      .select({ creditNoteNumber: creditNotes.creditNoteNumber })
      .from(creditNotes)
      .where(eq(creditNotes.id, id));
    expect(row.creditNoteNumber).toBe("CN-0001");
    const [seq] = await db
      .select({ nextNumber: invoiceSequences.nextNumber })
      .from(invoiceSequences)
      .where(eq(invoiceSequences.orgId, orgId));
    expect(seq.nextNumber).toBe(2);
  });

  it("is idempotent — second call returns the same number", async () => {
    const id = await makeDraftCreditNote();

    const first = await assignCreditNoteNumberIfMissing(id, orgId, db);
    const second = await assignCreditNoteNumberIfMissing(id, orgId, db);

    expect(first).toBe(second);
  });

  it("two parallel calls for the SAME credit note return the same number", async () => {
    const id = await makeDraftCreditNote();

    const [a, b] = await Promise.all([
      assignCreditNoteNumberIfMissing(id, orgId, db),
      assignCreditNoteNumberIfMissing(id, orgId, db),
    ]);

    expect(a).toBe(b);
  });

  it("two parallel calls for DIFFERENT credit notes produce consecutive numbers", async () => {
    const id1 = await makeDraftCreditNote();
    const id2 = await makeDraftCreditNote();

    const [n1, n2] = await Promise.all([
      assignCreditNoteNumberIfMissing(id1, orgId, db),
      assignCreditNoteNumberIfMissing(id2, orgId, db),
    ]);

    expect(n1).not.toBe(n2);
    const numbers = [n1, n2].sort();
    const a = parseInt(numbers[0].replace("CN-", ""), 10);
    const b = parseInt(numbers[1].replace("CN-", ""), 10);
    expect(b - a).toBe(1);
  });
});
