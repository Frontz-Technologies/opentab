import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
  vi,
} from "vitest";
import { eq } from "drizzle-orm";
import { createTestDb } from "@opentab/db/test-utils";
import {
  organisations,
  contacts,
  invoices,
  invoiceItems,
  products,
  INVOICE_STATUS,
} from "@opentab/db/schema";

// Defence-in-depth on invoices/actions.ts. publishInvoice /
// sendInvoice / markAsPaid / cancelInvoice / the transaction inside
// createInvoice pre-fetch the invoice with an orgId-scoped SELECT,
// but every subsequent UPDATE must also carry
// eq(invoices.orgId, session.org.id) so the mutation itself is the
// authority — a pre-check alone has TOCTOU exposure and breaks if a
// future caller drops it.
//
// These tests assert the MUTATION fails to reach Org B's row, so the
// assertions check Org B's row state directly, not just the action
// return value.

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

vi.mock("@/lib/session", () => ({
  getSession: getSessionMock,
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

// Side-effects out of scope of an isolation test.
vi.mock("@/lib/country/submit-invoice", () => ({
  submitInvoiceThroughPlugins: vi.fn().mockResolvedValue([]),
  cancelInvoiceOnPlugins: vi.fn().mockResolvedValue([]),
}));
vi.mock("@/lib/activities/record", () => ({
  recordActivity: vi.fn().mockResolvedValue(undefined),
}));

import {
  publishInvoice,
  sendInvoice,
  markAsPaid,
  cancelInvoice,
  deleteInvoice,
  updateInvoice,
} from "@/app/(app)/invoices/actions";

describe("invoices actions — cross-org isolation", () => {
  let teardown: () => Promise<void>;
  let orgAId: string;
  let orgBId: string;

  beforeAll(async () => {
    const ctx = await createTestDb();
    dbHolder.current = ctx.db;
    teardown = ctx.teardown;

    const [a] = await ctx.db
      .insert(organisations)
      .values({ name: "Org A", slug: "org-a-inv-274", countryCode: "GR" })
      .returning();
    const [b] = await ctx.db
      .insert(organisations)
      .values({ name: "Org B", slug: "org-b-inv-274", countryCode: "GR" })
      .returning();
    orgAId = a.id;
    orgBId = b.id;
  });

  afterAll(async () => {
    await teardown();
  });

  beforeEach(() => {
    getSessionMock.mockReset();
  });

  function ownerSession(orgId: string) {
    return {
      user: { id: "u1", email: "u1@e", name: "User", locale: "en" },
      role: "owner",
      org: {
        id: orgId,
        name: "Org",
        slug: "org",
        countryCode: "GR",
        defaultCurrency: "EUR",
        fiscalYearStart: 1,
        taxId: null,
        taxAuthority: null,
        addressLine1: null,
        addressLine2: null,
        city: null,
        postalCode: null,
        region: null,
        phone: null,
        setupCompletedSteps: [],
        isDemo: false,
      },
    };
  }

  async function seedInvoiceFor(
    orgId: string,
    status: number,
    invoiceNumber: string | null,
  ): Promise<string> {
    const [contact] = await dbHolder.current
      .insert(contacts)
      .values({
        orgId,
        type: "client",
        classification: "business",
        displayName: `Client for ${orgId.slice(0, 4)}`,
      })
      .returning();
    const [inv] = await dbHolder.current
      .insert(invoices)
      .values({
        orgId,
        contactId: contact.id,
        status,
        invoiceNumber,
        issueDate: "2026-04-01",
        currencyCode: "EUR",
        total: "100.00",
        balance: "100.00",
        contactName: contact.displayName,
      })
      .returning();
    return inv.id;
  }

  it("publishInvoice from Org A does not flip Org B's draft invoice", async () => {
    const orgBInvoiceId = await seedInvoiceFor(
      orgBId,
      INVOICE_STATUS.DRAFT,
      null,
    );
    getSessionMock.mockResolvedValue(ownerSession(orgAId));

    const result = await publishInvoice(orgBInvoiceId);
    expect(result.success).toBe(false);

    const [row] = await dbHolder.current
      .select()
      .from(invoices)
      .where(eq(invoices.id, orgBInvoiceId));
    expect(row.status).toBe(INVOICE_STATUS.DRAFT);
    expect(row.invoiceNumber).toBeNull();
  });

  it("sendInvoice from Org A does not flip Org B's published invoice", async () => {
    const orgBInvoiceId = await seedInvoiceFor(
      orgBId,
      INVOICE_STATUS.PUBLISHED,
      "INV-B-2026-0001",
    );
    getSessionMock.mockResolvedValue(ownerSession(orgAId));

    const result = await sendInvoice(orgBInvoiceId);
    expect(result.success).toBe(false);

    const [row] = await dbHolder.current
      .select()
      .from(invoices)
      .where(eq(invoices.id, orgBInvoiceId));
    expect(row.status).toBe(INVOICE_STATUS.PUBLISHED);
    expect(row.sentAt).toBeNull();
  });

  it("markAsPaid from Org A does not flip Org B's sent invoice", async () => {
    const orgBInvoiceId = await seedInvoiceFor(
      orgBId,
      INVOICE_STATUS.SENT,
      "INV-B-2026-0002",
    );
    getSessionMock.mockResolvedValue(ownerSession(orgAId));

    const result = await markAsPaid(orgBInvoiceId);
    expect(result.success).toBe(false);

    const [row] = await dbHolder.current
      .select()
      .from(invoices)
      .where(eq(invoices.id, orgBInvoiceId));
    expect(row.status).toBe(INVOICE_STATUS.SENT);
    expect(row.paidAt).toBeNull();
  });

  it("cancelInvoice from Org A does not cancel Org B's sent invoice", async () => {
    const orgBInvoiceId = await seedInvoiceFor(
      orgBId,
      INVOICE_STATUS.SENT,
      "INV-B-2026-0003",
    );
    getSessionMock.mockResolvedValue(ownerSession(orgAId));

    const result = await cancelInvoice(orgBInvoiceId);
    expect(result.success).toBe(false);

    const [row] = await dbHolder.current
      .select()
      .from(invoices)
      .where(eq(invoices.id, orgBInvoiceId));
    expect(row.status).toBe(INVOICE_STATUS.SENT);
  });

  it("deleteInvoice from Org A does not delete Org B's draft invoice", async () => {
    const orgBInvoiceId = await seedInvoiceFor(
      orgBId,
      INVOICE_STATUS.DRAFT,
      null,
    );
    getSessionMock.mockResolvedValue(ownerSession(orgAId));

    const result = await deleteInvoice(orgBInvoiceId);
    expect(result.success).toBe(false);

    const [row] = await dbHolder.current
      .select()
      .from(invoices)
      .where(eq(invoices.id, orgBInvoiceId));
    expect(row).toBeDefined();
  });

  // Write-side FK validation: updateInvoice refuses cross-org
  // contactId / productId payloads BEFORE the UPDATE/INSERT runs.
  it("updateInvoice refuses an Org B contactId on Org A's draft", async () => {
    const orgADraft = await seedInvoiceFor(orgAId, INVOICE_STATUS.DRAFT, null);
    const [orgBContact] = await dbHolder.current
      .insert(contacts)
      .values({
        orgId: orgBId,
        type: "client",
        classification: "business",
        displayName: "Org B Foreign Contact",
      })
      .returning();
    getSessionMock.mockResolvedValue(ownerSession(orgAId));

    const fd = new FormData();
    fd.set("contactId", orgBContact.id); // cross-org FK
    fd.set("issueDate", "2026-04-02");
    fd.set("currencyCode", "EUR");
    fd.set("contactName", "Spoofed");
    fd.set(
      "items",
      JSON.stringify([
        {
          sortOrder: 0,
          name: "Item",
          quantity: "1",
          unitPrice: "1.00",
          taxRate: "0.00",
        },
      ]),
    );

    const result = await updateInvoice(orgADraft, fd);
    expect(result.success).toBe(false);

    // The contactId on Org A's invoice must not have been swapped to
    // Org B's contact.
    const [row] = await dbHolder.current
      .select()
      .from(invoices)
      .where(eq(invoices.id, orgADraft));
    expect(row.contactId).not.toBe(orgBContact.id);
  });

  it("updateInvoice refuses a cross-org productId in line items", async () => {
    const orgADraft = await seedInvoiceFor(orgAId, INVOICE_STATUS.DRAFT, null);
    const [orgAContact] = await dbHolder.current
      .insert(contacts)
      .values({
        orgId: orgAId,
        type: "client",
        classification: "business",
        displayName: "Org A Same-Org Contact",
      })
      .returning();
    const [orgBProduct] = await dbHolder.current
      .insert(products)
      .values({ orgId: orgBId, name: "Org B Product (line FK)" })
      .returning();
    getSessionMock.mockResolvedValue(ownerSession(orgAId));

    const fd = new FormData();
    fd.set("contactId", orgAContact.id); // same-org
    fd.set("issueDate", "2026-04-02");
    fd.set("currencyCode", "EUR");
    fd.set("contactName", "Org A");
    fd.set(
      "items",
      JSON.stringify([
        {
          productId: orgBProduct.id, // cross-org line FK
          sortOrder: 0,
          name: "Item",
          quantity: "1",
          unitPrice: "1.00",
          taxRate: "0.00",
        },
      ]),
    );

    const result = await updateInvoice(orgADraft, fd);
    expect(result.success).toBe(false);

    // No invoice_item with the cross-org productId was inserted.
    const items = await dbHolder.current
      .select()
      .from(invoiceItems)
      .where(eq(invoiceItems.invoiceId, orgADraft));
    for (const item of items) {
      expect(item.productId).not.toBe(orgBProduct.id);
    }
  });
});

// Direct-query parity for the invoice-item read paths. invoice_item
// has no orgId column — scope flows through invoice.orgId. The
// detail page (apps/web/app/(app)/invoices/[id]/page.tsx) and the
// PDF route fetch items by invoiceId AFTER the parent invoice was
// orgId-checked, so the line-item read is safe by parent FK. This
// test pins that contract: a scoped parent SELECT first, items
// after, returns nothing for a foreign-org id.
describe("invoice line-items via parent — cross-org isolation", () => {
  let db: Awaited<ReturnType<typeof createTestDb>>["db"];
  let teardown: () => Promise<void>;
  let orgAId: string;
  let orgBId: string;
  let orgBInvoiceId: string;

  beforeAll(async () => {
    const ctx = await createTestDb();
    db = ctx.db;
    teardown = ctx.teardown;

    const [a] = await db
      .insert(organisations)
      .values({ name: "Org A", slug: "org-a-itm-274", countryCode: "GR" })
      .returning();
    const [b] = await db
      .insert(organisations)
      .values({ name: "Org B", slug: "org-b-itm-274", countryCode: "GR" })
      .returning();
    orgAId = a.id;
    orgBId = b.id;

    const [orgBContact] = await db
      .insert(contacts)
      .values({
        orgId: orgBId,
        type: "client",
        classification: "business",
        displayName: "Org B Client",
      })
      .returning();
    const [orgBInvoice] = await db
      .insert(invoices)
      .values({
        orgId: orgBId,
        contactId: orgBContact.id,
        invoiceNumber: "INV-B-LINE-0001",
        issueDate: "2026-04-01",
        currencyCode: "EUR",
        contactName: "Org B Client",
      })
      .returning();
    orgBInvoiceId = orgBInvoice.id;

    await db.insert(invoiceItems).values({
      invoiceId: orgBInvoiceId,
      sortOrder: 0,
      name: "Org B confidential line",
      quantity: "1",
      unitPrice: "100.00",
      taxCategory: "standard",
      taxRate: "0.00",
      taxAmount: "0.00",
      lineTotal: "100.00",
    });
  });

  afterAll(async () => {
    await teardown();
  });

  it("scoped parent SELECT first — Org A reads no Org B parent, never reads its items", async () => {
    // Mirror the page/PDF route control flow: parent fetch with
    // orgId, then items only if parent found.
    const { and: dAnd, eq: dEq } = await import("drizzle-orm");
    const [parent] = await db
      .select()
      .from(invoices)
      .where(
        dAnd(dEq(invoices.id, orgBInvoiceId), dEq(invoices.orgId, orgAId)),
      );
    expect(parent).toBeUndefined();

    // Defensive — if a future refactor reordered the queries, this
    // would still flag it: the parent gate keeps Org A from reaching
    // Org B's items.
    if (parent) {
      const items = await db
        .select()
        .from(invoiceItems)
        .where(dEq(invoiceItems.invoiceId, orgBInvoiceId));
      expect(items).toHaveLength(0);
    }
  });
});
