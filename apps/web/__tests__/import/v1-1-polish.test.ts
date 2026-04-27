import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { createTestDb } from "@opentab/db/test-utils";
import { eq, and } from "drizzle-orm";
import {
  organisations,
  contacts,
  invoices,
  creditNotes,
  INVOICE_STATUS,
  CREDIT_NOTE_STATUS,
} from "@opentab/db/schema";

// v1.1 import polish (#220):
// 1. Auto-create-missing-contact when toggle is ON
// 2. Empty-invoice-number → status = DRAFT, idempotency falls back
//    to a contact+date+total fingerprint

const { dbHolder, getSessionMock, fakeFileBuffer } = vi.hoisted(() => ({
  dbHolder: {
    current: null as unknown as Awaited<
      ReturnType<typeof import("@opentab/db/test-utils").createTestDb>
    >["db"],
  },
  getSessionMock: vi.fn(),
  fakeFileBuffer: { current: Buffer.from("") },
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
vi.mock("@/lib/expenses/file-storage", () => ({
  getImportTempFile: async () => fakeFileBuffer.current,
  deleteTempFile: async () => undefined,
  storeImportTempFile: async () => "test-key",
}));

import { commitImport } from "../../app/(app)/import/[entity]/actions";

function rowsToCsv(rows: Record<string, string>[]): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const lines = [headers.join(",")];
  for (const row of rows) {
    lines.push(headers.map((h) => row[h] ?? "").join(","));
  }
  return lines.join("\n");
}

async function commitFromRows(
  rows: Record<string, string>[],
  args: {
    entityKey: string;
    mapping: Record<string, string | null>;
    skippedByUser?: number[];
    autoCreateToggles?: Record<string, boolean>;
  },
) {
  fakeFileBuffer.current = Buffer.from(rowsToCsv(rows));
  return commitImport({
    entityKey: args.entityKey,
    importId: "tmp_test",
    mapping: args.mapping,
    skippedByUser: args.skippedByUser ?? [],
    autoCreateToggles: args.autoCreateToggles ?? {},
  });
}

describe("import v1.1 polish — auto-create + empty-number (#220)", () => {
  let teardown: () => Promise<void>;
  let orgId: string;

  beforeAll(async () => {
    const ctx = await createTestDb();
    dbHolder.current = ctx.db;
    teardown = ctx.teardown;

    const [org] = await ctx.db
      .insert(organisations)
      .values({
        name: "Test",
        slug: "t-import-v1-1",
        countryCode: "GR",
      })
      .returning();
    orgId = org.id;

    getSessionMock.mockResolvedValue({
      org: { id: orgId },
      user: { id: "user-1" },
      role: "owner",
    });
  });

  afterAll(async () => teardown());

  it("invoice import with unknown contact + autoCreate ON: creates contact + invoice", async () => {
    const result = await commitFromRows(
      [
        {
          invoiceNumber: "INV-AUTO-1",
          issueDate: "2026-04-26",
          contactName: "Auto-Created Co",
          contactVatNumber: "EL999111222",
          total: "100.00",
          itemName: "Hours",
          quantity: "1",
          unitPrice: "100.00",
          taxRate: "0",
        },
      ],
      {
        entityKey: "invoices",
        mapping: {
          invoiceNumber: "invoiceNumber",
          issueDate: "issueDate",
          contactName: "contactName",
          contactVatNumber: "contactVatNumber",
          total: "total",
          itemName: "itemName",
          quantity: "quantity",
          unitPrice: "unitPrice",
          taxRate: "taxRate",
        },
        skippedByUser: [],
        autoCreateToggles: { contact: true },
      },
    );

    expect(result.success).toBe(true);
    expect(result.created).toBe(1);

    const [contact] = await dbHolder.current
      .select()
      .from(contacts)
      .where(
        and(
          eq(contacts.orgId, orgId),
          eq(contacts.displayName, "Auto-Created Co"),
        ),
      );
    expect(contact).toBeDefined();
    expect(contact.type).toBe("client");
    expect(contact.vatNumber).toBe("EL999111222");
    expect(contact.importIdempotencyKey).toBeTruthy();

    const [invoice] = await dbHolder.current
      .select()
      .from(invoices)
      .where(eq(invoices.invoiceNumber, "INV-AUTO-1"));
    expect(invoice.contactId).toBe(contact.id);
    expect(invoice.status).toBe(INVOICE_STATUS.SENT);
  });

  it("invoice import with unknown contact + autoCreate OFF: row blocked", async () => {
    const result = await commitFromRows(
      [
        {
          invoiceNumber: "INV-BLOCKED-1",
          issueDate: "2026-04-26",
          contactName: "Strict Mode Co",
          total: "100.00",
          itemName: "Hours",
          quantity: "1",
          unitPrice: "100.00",
          taxRate: "0",
        },
      ],
      {
        entityKey: "invoices",
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
        autoCreateToggles: { contact: false },
      },
    );

    expect(result.failed).toBe(1);
    expect(result.created).toBe(0);
    const blocked = await dbHolder.current
      .select()
      .from(contacts)
      .where(eq(contacts.displayName, "Strict Mode Co"));
    expect(blocked).toHaveLength(0);
  });

  it("invoice import with empty invoiceNumber: status = DRAFT, no number assigned", async () => {
    // Seed the contact first so contact-resolution doesn't take over
    await dbHolder.current
      .insert(contacts)
      .values({ orgId, displayName: "Draft Test Co" });

    const result = await commitFromRows(
      [
        {
          invoiceNumber: "", // empty
          issueDate: "2026-04-26",
          contactName: "Draft Test Co",
          total: "200.00",
          itemName: "Service",
          quantity: "1",
          unitPrice: "200.00",
          taxRate: "0",
        },
      ],
      {
        entityKey: "invoices",
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
        autoCreateToggles: { contact: true },
      },
    );

    expect(result.success).toBe(true);
    expect(result.created).toBe(1);

    const drafts = await dbHolder.current
      .select()
      .from(invoices)
      .where(
        and(
          eq(invoices.contactName, "Draft Test Co"),
          eq(invoices.total, "200.00"),
        ),
      );
    expect(drafts).toHaveLength(1);
    expect(drafts[0].status).toBe(INVOICE_STATUS.DRAFT);
    expect(drafts[0].invoiceNumber).toBeNull();
  });

  it("re-importing the same empty-number CSV is a no-op (fingerprint dedup)", async () => {
    // First import lands the row (above). Re-run the same import.
    const result = await commitFromRows(
      [
        {
          invoiceNumber: "",
          issueDate: "2026-04-26",
          contactName: "Draft Test Co",
          total: "200.00",
          itemName: "Service",
          quantity: "1",
          unitPrice: "200.00",
          taxRate: "0",
        },
      ],
      {
        entityKey: "invoices",
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
        autoCreateToggles: { contact: true },
      },
    );

    expect(result.created).toBe(0);
    expect(result.skippedDup).toBe(1);
  });

  it("credit-note import with empty number: status = DRAFT", async () => {
    await dbHolder.current
      .insert(contacts)
      .values({ orgId, displayName: "Draft CN Co" });

    const result = await commitFromRows(
      [
        {
          creditNoteNumber: "",
          issueDate: "2026-04-26",
          contactName: "Draft CN Co",
          total: "50.00",
          reason: "return",
          itemName: "Refund",
          quantity: "1",
          unitPrice: "50.00",
          taxRate: "0",
        },
      ],
      {
        entityKey: "credit-notes",
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
        autoCreateToggles: { contact: true },
      },
    );

    expect(result.success).toBe(true);
    expect(result.created).toBe(1);

    const [draft] = await dbHolder.current
      .select()
      .from(creditNotes)
      .where(
        and(
          eq(creditNotes.contactName, "Draft CN Co"),
          eq(creditNotes.total, "50.00"),
        ),
      );
    expect(draft.status).toBe(CREDIT_NOTE_STATUS.DRAFT);
    expect(draft.creditNoteNumber).toBeNull();
  });

  it("re-import on the same auto-created-contact CSV reuses the stub (no duplicate contact)", async () => {
    // Re-run the very first test's CSV — same contactName "Auto-Created Co"
    await commitFromRows(
      [
        {
          invoiceNumber: "INV-AUTO-2",
          issueDate: "2026-04-26",
          contactName: "Auto-Created Co",
          contactVatNumber: "EL999111222",
          total: "120.00",
          itemName: "Day rate",
          quantity: "1",
          unitPrice: "120.00",
          taxRate: "0",
        },
      ],
      {
        entityKey: "invoices",
        mapping: {
          invoiceNumber: "invoiceNumber",
          issueDate: "issueDate",
          contactName: "contactName",
          contactVatNumber: "contactVatNumber",
          total: "total",
          itemName: "itemName",
          quantity: "quantity",
          unitPrice: "unitPrice",
          taxRate: "taxRate",
        },
        skippedByUser: [],
        autoCreateToggles: { contact: true },
      },
    );

    // Should still be exactly 1 contact named "Auto-Created Co"
    const all = await dbHolder.current
      .select()
      .from(contacts)
      .where(
        and(
          eq(contacts.orgId, orgId),
          eq(contacts.displayName, "Auto-Created Co"),
        ),
      );
    expect(all).toHaveLength(1);
  });
});
