import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createTestDb } from "@opentab/db/test-utils";
import {
  organisations,
  contacts,
  invoices,
  creditNotes,
  INVOICE_STATUS,
  CREDIT_NOTE_STATUS,
  CREDIT_NOTE_REASON,
} from "@opentab/db/schema";
import { getRevenue } from "../lib/reports/queries";

// Revenue must subtract published+sent credit notes from the same
// period. Cancelled credits and drafts must NOT subtract.
describe("getRevenue (#133 — credit-note subtraction)", () => {
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
      .values({
        name: "Test Org",
        slug: "test-org-revenue-cn",
        countryCode: "GR",
      })
      .returning();
    orgId = org.id;

    const [contact] = await db
      .insert(contacts)
      .values({ orgId, displayName: "Test Client" })
      .returning();
    contactId = contact.id;

    // Two SENT invoices totalling 1500
    await db.insert(invoices).values([
      {
        orgId,
        contactId,
        status: INVOICE_STATUS.SENT,
        invoiceNumber: "INV-0001",
        issueDate: "2026-04-01",
        contactName: "Test Client",
        subtotal: "1000.00",
        taxAmount: "0.00",
        total: "1000.00",
      },
      {
        orgId,
        contactId,
        status: INVOICE_STATUS.PAID,
        invoiceNumber: "INV-0002",
        issueDate: "2026-04-15",
        contactName: "Test Client",
        subtotal: "500.00",
        taxAmount: "0.00",
        total: "500.00",
      },
    ]);

    // PUBLISHED credit note for 200 → must subtract
    // SENT credit note for 100 → must subtract
    // CANCELLED credit note for 999 → must NOT subtract
    // DRAFT credit note for 999 → must NOT subtract
    await db.insert(creditNotes).values([
      {
        orgId,
        contactId,
        status: CREDIT_NOTE_STATUS.PUBLISHED,
        creditNoteNumber: "CN-0001",
        issueDate: "2026-04-10",
        contactName: "Test Client",
        subtotal: "200.00",
        taxAmount: "0.00",
        total: "200.00",
        reason: CREDIT_NOTE_REASON.RETURN,
      },
      {
        orgId,
        contactId,
        status: CREDIT_NOTE_STATUS.SENT,
        creditNoteNumber: "CN-0002",
        issueDate: "2026-04-20",
        contactName: "Test Client",
        subtotal: "100.00",
        taxAmount: "0.00",
        total: "100.00",
        reason: CREDIT_NOTE_REASON.CORRECTION,
      },
      {
        orgId,
        contactId,
        status: CREDIT_NOTE_STATUS.CANCELLED,
        creditNoteNumber: "CN-0003",
        issueDate: "2026-04-22",
        contactName: "Test Client",
        subtotal: "999.00",
        taxAmount: "0.00",
        total: "999.00",
        reason: CREDIT_NOTE_REASON.OTHER,
      },
      {
        orgId,
        contactId,
        status: CREDIT_NOTE_STATUS.DRAFT,
        creditNoteNumber: null,
        issueDate: "2026-04-23",
        contactName: "Test Client",
        subtotal: "999.00",
        taxAmount: "0.00",
        total: "999.00",
        reason: CREDIT_NOTE_REASON.OTHER,
      },
    ]);
  });

  afterAll(async () => {
    await teardown();
  });

  it("subtracts only published+sent credits from gross revenue", async () => {
    const start = new Date("2026-04-01");
    const end = new Date("2026-04-30");

    const result = await getRevenue(orgId, start, end, db);

    expect(result.total).toBe(1200); // 1500 − 200 − 100
    expect(result.count).toBe(2); // count tracks invoices only
  });

  it("returns gross revenue when no credit notes exist in window", async () => {
    const start = new Date("2026-05-01");
    const end = new Date("2026-05-31");

    const result = await getRevenue(orgId, start, end, db);

    expect(result.total).toBe(0);
    expect(result.count).toBe(0);
  });
});
