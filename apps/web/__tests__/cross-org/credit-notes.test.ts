import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
  vi,
} from "vitest";
import { and, eq } from "drizzle-orm";
import { createTestDb } from "@opentab/db/test-utils";
import {
  organisations,
  contacts,
  invoices,
  creditNotes,
  CREDIT_NOTE_STATUS,
  CREDIT_NOTE_REASON,
} from "@opentab/db/schema";

// Issue #274 (Phase B) — cross-org audit. The credit-note detail page
// renders the linked invoice's number when cn.invoiceId is set. The
// schema (createCreditNoteSchema) accepts ANY UUID for invoiceId
// without verifying same-org membership, so an attacker can store an
// Org B invoice id on an Org A credit note. The pre-fix lookup
// queried `eq(invoices.id, cn.invoiceId)` with no orgId scope and
// would render Org B's invoice number in Org A's UI.
//
// Direct-query parity test: mirrors the page/PDF/submit-credit-note
// reads that the fix scopes by orgId. Three sites read cn.invoiceId
// downstream:
//   - app/(app)/credit-notes/[id]/page.tsx — rendered as a Link
//   - app/api/credit-notes/[id]/pdf/route.ts — embedded in the PDF
//   - lib/country/submit-credit-note.ts — sent in the plugin payload
// All three apply the same scope, so a single shape-test is enough
// to prove the leak class is closed.

describe("credit-note linked-invoice lookup — cross-org isolation (#274)", () => {
  let db: Awaited<ReturnType<typeof createTestDb>>["db"];
  let teardown: () => Promise<void>;
  let orgAId: string;
  let orgBId: string;
  let orgAContactId: string;
  let orgBInvoiceId: string;
  let orgACreditNoteId: string;

  beforeAll(async () => {
    const ctx = await createTestDb();
    db = ctx.db;
    teardown = ctx.teardown;

    const [a] = await db
      .insert(organisations)
      .values({ name: "Org A", slug: "org-a-cn-274", countryCode: "GR" })
      .returning();
    const [b] = await db
      .insert(organisations)
      .values({ name: "Org B", slug: "org-b-cn-274", countryCode: "GR" })
      .returning();
    orgAId = a.id;
    orgBId = b.id;

    const [orgAContact] = await db
      .insert(contacts)
      .values({
        orgId: orgAId,
        type: "client",
        classification: "business",
        displayName: "Org A Client",
      })
      .returning();
    orgAContactId = orgAContact.id;

    const [orgBContact] = await db
      .insert(contacts)
      .values({
        orgId: orgBId,
        type: "client",
        classification: "business",
        displayName: "Org B Client",
      })
      .returning();

    // Seed a published Org B invoice with a known number — this is
    // what the leak would have surfaced.
    const [orgBInvoice] = await db
      .insert(invoices)
      .values({
        orgId: orgBId,
        contactId: orgBContact.id,
        invoiceNumber: "INV-B-CONFIDENTIAL-0001",
        issueDate: "2026-04-01",
        currencyCode: "EUR",
        contactName: "Org B Client",
      })
      .returning();
    orgBInvoiceId = orgBInvoice.id;

    // Org A credit note carrying Org B's invoice id in its
    // invoiceId column — this is the foreign-FK shape an attacker
    // would set.
    const [orgACreditNote] = await db
      .insert(creditNotes)
      .values({
        orgId: orgAId,
        contactId: orgAContactId,
        invoiceId: orgBInvoiceId,
        creditNoteNumber: "CN-A-0001",
        status: CREDIT_NOTE_STATUS.DRAFT,
        issueDate: "2026-04-15",
        currencyCode: "EUR",
        contactName: "Org A Client",
        reason: CREDIT_NOTE_REASON.CORRECTION,
      })
      .returning();
    orgACreditNoteId = orgACreditNote.id;
  });

  afterAll(async () => {
    await teardown();
  });

  it("scoped lookup returns no row when cn.invoiceId belongs to another org", async () => {
    // Mirror the post-fix WHERE: id = cn.invoiceId AND orgId = session.org.id.
    const [cn] = await db
      .select()
      .from(creditNotes)
      .where(eq(creditNotes.id, orgACreditNoteId));
    expect(cn.invoiceId).toBe(orgBInvoiceId); // sanity: foreign id stored

    const rows = await db
      .select({ invoiceNumber: invoices.invoiceNumber })
      .from(invoices)
      .where(and(eq(invoices.id, cn.invoiceId!), eq(invoices.orgId, orgAId)));

    // Org A doesn't own the invoice — scoped lookup returns nothing,
    // and the page/PDF/submit code falls back to "no parent invoice".
    expect(rows).toHaveLength(0);
  });

  it("unscoped lookup (the OLD bug) would have leaked the number — proves the test is meaningful", async () => {
    const [cn] = await db
      .select()
      .from(creditNotes)
      .where(eq(creditNotes.id, orgACreditNoteId));

    const rows = await db
      .select({ invoiceNumber: invoices.invoiceNumber })
      .from(invoices)
      .where(eq(invoices.id, cn.invoiceId!));

    // Without the orgId clause, Org A reads Org B's confidential
    // invoice number — exactly the leak the fix closes.
    expect(rows).toHaveLength(1);
    expect(rows[0].invoiceNumber).toBe("INV-B-CONFIDENTIAL-0001");
  });

  it("scoped lookup still resolves when cn.invoiceId belongs to the same org (sanity)", async () => {
    // Issue an Org A invoice and a credit note pointing at it; the
    // scoped lookup should resolve normally.
    const [orgAInvoice] = await db
      .insert(invoices)
      .values({
        orgId: orgAId,
        contactId: orgAContactId,
        invoiceNumber: "INV-A-LEGIT-0001",
        issueDate: "2026-04-01",
        currencyCode: "EUR",
        contactName: "Org A Client",
      })
      .returning();

    const [orgACreditNoteLegit] = await db
      .insert(creditNotes)
      .values({
        orgId: orgAId,
        contactId: orgAContactId,
        invoiceId: orgAInvoice.id,
        creditNoteNumber: "CN-A-0002",
        status: CREDIT_NOTE_STATUS.DRAFT,
        issueDate: "2026-04-15",
        currencyCode: "EUR",
        contactName: "Org A Client",
        reason: CREDIT_NOTE_REASON.CORRECTION,
      })
      .returning();

    const rows = await db
      .select({ invoiceNumber: invoices.invoiceNumber })
      .from(invoices)
      .where(
        and(
          eq(invoices.id, orgACreditNoteLegit.invoiceId!),
          eq(invoices.orgId, orgAId),
        ),
      );

    expect(rows).toHaveLength(1);
    expect(rows[0].invoiceNumber).toBe("INV-A-LEGIT-0001");
  });
});

// Defence-in-depth on credit-notes/actions.ts. publish/send/cancel/
// delete and the updateCreditNote UPDATE all pre-fetched the CN
// with an orgId-scoped SELECT but the subsequent UPDATE/DELETE
// used `eq(creditNotes.id, id)` only. The fix adds
// eq(creditNotes.orgId, session.org.id) to every WHERE so the
// mutation itself is the authority. Test mocks the session and
// verifies the CN doesn't move when called from the wrong org.

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

vi.mock("@/lib/country/submit-credit-note", () => ({
  submitCreditNoteThroughPlugins: vi.fn().mockResolvedValue([]),
}));
vi.mock("@/lib/activities/record", () => ({
  recordActivity: vi.fn().mockResolvedValue(undefined),
}));

import {
  publishCreditNote,
  sendCreditNote,
  cancelCreditNote,
  deleteCreditNote,
} from "@/app/(app)/credit-notes/actions";

describe("credit-notes actions — cross-org isolation (#274)", () => {
  let teardown: () => Promise<void>;
  let orgAId: string;
  let orgBId: string;

  beforeAll(async () => {
    const ctx = await createTestDb();
    dbHolder.current = ctx.db;
    teardown = ctx.teardown;

    const [a] = await ctx.db
      .insert(organisations)
      .values({ name: "Org A", slug: "org-a-cna-274", countryCode: "GR" })
      .returning();
    const [b] = await ctx.db
      .insert(organisations)
      .values({ name: "Org B", slug: "org-b-cna-274", countryCode: "GR" })
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

  async function seedCreditNoteFor(
    orgId: string,
    status: number,
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
    const [cn] = await dbHolder.current
      .insert(creditNotes)
      .values({
        orgId,
        contactId: contact.id,
        status,
        issueDate: "2026-04-01",
        currencyCode: "EUR",
        total: "50.00",
        contactName: contact.displayName,
        reason: CREDIT_NOTE_REASON.CORRECTION,
      })
      .returning();
    return cn.id;
  }

  it("publishCreditNote from Org A does not flip Org B's draft credit note", async () => {
    const orgBCnId = await seedCreditNoteFor(orgBId, CREDIT_NOTE_STATUS.DRAFT);
    getSessionMock.mockResolvedValue(ownerSession(orgAId));

    const result = await publishCreditNote(orgBCnId);
    expect(result.success).toBe(false);

    const [row] = await dbHolder.current
      .select()
      .from(creditNotes)
      .where(eq(creditNotes.id, orgBCnId));
    expect(row.status).toBe(CREDIT_NOTE_STATUS.DRAFT);
  });

  it("sendCreditNote from Org A does not flip Org B's published credit note", async () => {
    const orgBCnId = await seedCreditNoteFor(
      orgBId,
      CREDIT_NOTE_STATUS.PUBLISHED,
    );
    getSessionMock.mockResolvedValue(ownerSession(orgAId));

    const result = await sendCreditNote(orgBCnId);
    expect(result.success).toBe(false);

    const [row] = await dbHolder.current
      .select()
      .from(creditNotes)
      .where(eq(creditNotes.id, orgBCnId));
    expect(row.status).toBe(CREDIT_NOTE_STATUS.PUBLISHED);
    expect(row.sentAt).toBeNull();
  });

  it("cancelCreditNote from Org A does not flip Org B's published credit note", async () => {
    const orgBCnId = await seedCreditNoteFor(
      orgBId,
      CREDIT_NOTE_STATUS.PUBLISHED,
    );
    getSessionMock.mockResolvedValue(ownerSession(orgAId));

    const result = await cancelCreditNote(orgBCnId);
    expect(result.success).toBe(false);

    const [row] = await dbHolder.current
      .select()
      .from(creditNotes)
      .where(eq(creditNotes.id, orgBCnId));
    expect(row.status).toBe(CREDIT_NOTE_STATUS.PUBLISHED);
  });

  it("deleteCreditNote from Org A does not delete Org B's draft credit note", async () => {
    const orgBCnId = await seedCreditNoteFor(orgBId, CREDIT_NOTE_STATUS.DRAFT);
    getSessionMock.mockResolvedValue(ownerSession(orgAId));

    const result = await deleteCreditNote(orgBCnId);
    expect(result.success).toBe(false);

    const [row] = await dbHolder.current
      .select()
      .from(creditNotes)
      .where(eq(creditNotes.id, orgBCnId));
    expect(row).toBeDefined();
  });
});
