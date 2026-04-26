import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { createTestDb } from "@opentab/db/test-utils";
import { eq } from "drizzle-orm";
import {
  organisations,
  contacts,
  invoices,
  invoiceItems,
  creditNotes,
  creditNoteItems,
} from "@opentab/db/schema";

// Tester PR #219 High regression. The previous unit-tests asserted on
// the descriptor + grouping helper in isolation; nothing exercised
// the end-to-end commit path. Result: invoices and credit-notes
// imports landed header-only, line items silently dropped via the
// idempotency dedup. This test commits a 2-line CSV through the real
// commitImport pipeline (mocked session/db) and asserts BOTH the
// header table AND the items table get rows.

const { dbHolder, getSessionMock } = vi.hoisted(() => ({
  dbHolder: {
    current: null as unknown as Awaited<
      ReturnType<typeof import("@opentab/db/test-utils").createTestDb>
    >["db"],
  },
  getSessionMock: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  get db() {
    return dbHolder.current;
  },
}));
vi.mock("@/lib/session", () => ({ getSession: getSessionMock }));
vi.mock("@/lib/activities/record", () => ({
  recordActivity: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { commitImport } from "../../app/(app)/import/[entity]/actions";

describe("commitImport line-item insertion (#215 PR-B High)", () => {
  let teardown: () => Promise<void>;
  let orgId: string;
  let contactId: string;

  beforeAll(async () => {
    const ctx = await createTestDb();
    dbHolder.current = ctx.db;
    teardown = ctx.teardown;

    const [org] = await ctx.db
      .insert(organisations)
      .values({
        name: "Test",
        slug: "t-import-items",
        countryCode: "GR",
      })
      .returning();
    orgId = org.id;

    const [c] = await ctx.db
      .insert(contacts)
      .values({ orgId, displayName: "Acme Co" })
      .returning();
    contactId = c.id;

    getSessionMock.mockResolvedValue({
      org: { id: orgId },
      user: { id: "user-1" },
      role: "owner",
    });
  });

  afterAll(async () => {
    await teardown();
  });

  it("invoice import: 2-row CSV lands 1 invoice + 2 invoice_items", async () => {
    const result = await commitImport({
      entityKey: "invoices",
      rows: [
        {
          invoiceNumber: "INV-2001",
          issueDate: "2026-04-25",
          contactName: "Acme Co",
          total: "100.00",
          itemName: "Hours",
          quantity: "10",
          unitPrice: "10.00",
          taxRate: "0",
        },
        {
          invoiceNumber: "INV-2001",
          issueDate: "2026-04-25",
          contactName: "Acme Co",
          total: "100.00",
          itemName: "Setup fee",
          quantity: "1",
          unitPrice: "50.00",
          taxRate: "0",
        },
      ],
      mapping: {
        invoiceNumber: "invoiceNumber",
        issueDate: "issueDate",
        contactName: "contactName",
        total: "total",
        itemName: "itemName",
        quantity: "quantity",
        unitPrice: "unitPrice",
        taxRate: "taxRate",
      },
      skippedByUser: [],
      autoCreateToggles: {},
    });

    expect(result.success).toBe(true);
    // Multi-row dedup means runner inserts 1 header (the second row's
    // idempotency hash collides on invoiceNumber). The post-pass then
    // inserts 2 items keyed on that header.
    const headers = await dbHolder.current
      .select()
      .from(invoices)
      .where(eq(invoices.invoiceNumber, "INV-2001"));
    expect(headers).toHaveLength(1);
    expect(headers[0].contactId).toBe(contactId);

    const items = await dbHolder.current
      .select()
      .from(invoiceItems)
      .where(eq(invoiceItems.invoiceId, headers[0].id));
    expect(items).toHaveLength(2);
    expect(items.map((i) => i.name).sort()).toEqual(["Hours", "Setup fee"]);
  });

  it("credit-note import: 2-row CSV lands 1 credit_note + 2 credit_note_items", async () => {
    const result = await commitImport({
      entityKey: "credit-notes",
      rows: [
        {
          creditNoteNumber: "CN-2001",
          issueDate: "2026-04-25",
          contactName: "Acme Co",
          total: "100.00",
          reason: "return",
          itemName: "Refund line A",
          quantity: "1",
          unitPrice: "50.00",
          taxRate: "0",
        },
        {
          creditNoteNumber: "CN-2001",
          issueDate: "2026-04-25",
          contactName: "Acme Co",
          total: "100.00",
          reason: "return",
          itemName: "Refund line B",
          quantity: "1",
          unitPrice: "50.00",
          taxRate: "0",
        },
      ],
      mapping: {
        creditNoteNumber: "creditNoteNumber",
        issueDate: "issueDate",
        contactName: "contactName",
        total: "total",
        reason: "reason",
        itemName: "itemName",
        quantity: "quantity",
        unitPrice: "unitPrice",
        taxRate: "taxRate",
      },
      skippedByUser: [],
      autoCreateToggles: {},
    });

    expect(result.success).toBe(true);
    const headers = await dbHolder.current
      .select()
      .from(creditNotes)
      .where(eq(creditNotes.creditNoteNumber, "CN-2001"));
    expect(headers).toHaveLength(1);

    const items = await dbHolder.current
      .select()
      .from(creditNoteItems)
      .where(eq(creditNoteItems.creditNoteId, headers[0].id));
    expect(items).toHaveLength(2);
    expect(items.map((i) => i.name).sort()).toEqual([
      "Refund line A",
      "Refund line B",
    ]);
  });
});
