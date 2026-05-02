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
  products,
  quotes,
  QUOTE_STATUS,
} from "@opentab/db/schema";

// Defence-in-depth on quotes/actions.ts. convertToInvoice's UPDATE
// must pair `eq(quotes.id, id)` with `eq(quotes.orgId, session.org.id)`
// on the WHERE — like every other quote mutation in the file — so the
// pre-check at the top of the action is not the only authorisation
// gate.

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

import { convertToInvoice, createQuote } from "@/app/(app)/quotes/actions";

describe("quotes actions — cross-org isolation (#274)", () => {
  let teardown: () => Promise<void>;
  let orgAId: string;
  let orgBId: string;

  beforeAll(async () => {
    const ctx = await createTestDb();
    dbHolder.current = ctx.db;
    teardown = ctx.teardown;

    const [a] = await ctx.db
      .insert(organisations)
      .values({ name: "Org A", slug: "org-a-q-274", countryCode: "GR" })
      .returning();
    const [b] = await ctx.db
      .insert(organisations)
      .values({ name: "Org B", slug: "org-b-q-274", countryCode: "GR" })
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

  it("createQuote refuses an Org B contactId when called from Org A's session", async () => {
    const [orgAContact] = await dbHolder.current
      .insert(contacts)
      .values({
        orgId: orgAId,
        type: "client",
        classification: "business",
        displayName: "Org A Client (FK guard)",
      })
      .returning();
    const [orgBContact] = await dbHolder.current
      .insert(contacts)
      .values({
        orgId: orgBId,
        type: "client",
        classification: "business",
        displayName: "Org B Client (FK guard)",
      })
      .returning();

    getSessionMock.mockResolvedValue(ownerSession(orgAId));

    const fd = new FormData();
    fd.set("contactId", orgBContact.id); // Cross-org FK
    fd.set("issueDate", "2026-04-01");
    fd.set("currencyCode", "EUR");
    fd.set("contactName", "Spoofed Name");
    fd.set(
      "items",
      JSON.stringify([
        {
          sortOrder: 0,
          name: "Item",
          quantity: "1",
          unitPrice: "10.00",
          taxRate: "0.00",
        },
      ]),
    );

    const result = await createQuote(fd);
    expect(result.success).toBe(false);
    if (!result.success) {
      // The FK guard maps cross-org-access to a top-level error.
      expect(JSON.stringify(result.error)).toMatch(/not found/i);
    }

    // No quote was inserted into either org.
    const allOrgA = await dbHolder.current
      .select()
      .from(quotes)
      .where(eq(quotes.orgId, orgAId));
    expect(allOrgA).toHaveLength(0);

    // Sanity: same-org call succeeds.
    const okFd = new FormData();
    okFd.set("contactId", orgAContact.id);
    okFd.set("issueDate", "2026-04-01");
    okFd.set("currencyCode", "EUR");
    okFd.set("contactName", "Org A Client");
    okFd.set(
      "items",
      JSON.stringify([
        {
          sortOrder: 0,
          name: "Item",
          quantity: "1",
          unitPrice: "10.00",
          taxRate: "0.00",
        },
      ]),
    );
    const ok = await createQuote(okFd);
    expect(ok.success).toBe(true);
  });

  it("createQuote refuses an Org B productId in line items when called from Org A's session", async () => {
    const [orgAContact] = await dbHolder.current
      .insert(contacts)
      .values({
        orgId: orgAId,
        type: "client",
        classification: "business",
        displayName: "Org A Client (product FK)",
      })
      .returning();
    const [orgBProduct] = await dbHolder.current
      .insert(products)
      .values({ orgId: orgBId, name: "Org B Product" })
      .returning();

    getSessionMock.mockResolvedValue(ownerSession(orgAId));

    const fd = new FormData();
    fd.set("contactId", orgAContact.id);
    fd.set("issueDate", "2026-04-01");
    fd.set("currencyCode", "EUR");
    fd.set("contactName", "Org A Client");
    fd.set(
      "items",
      JSON.stringify([
        {
          productId: orgBProduct.id, // Cross-org FK
          sortOrder: 0,
          name: "Item",
          quantity: "1",
          unitPrice: "10.00",
          taxRate: "0.00",
        },
      ]),
    );

    const result = await createQuote(fd);
    expect(result.success).toBe(false);
  });

  it("convertToInvoice from Org A does not flip Org B's accepted quote to converted", async () => {
    const [orgBContact] = await dbHolder.current
      .insert(contacts)
      .values({
        orgId: orgBId,
        type: "client",
        classification: "business",
        displayName: "Org B Client",
      })
      .returning();
    const [orgBQuote] = await dbHolder.current
      .insert(quotes)
      .values({
        orgId: orgBId,
        contactId: orgBContact.id,
        quoteNumber: "QTE-B-0001",
        status: QUOTE_STATUS.ACCEPTED,
        issueDate: "2026-04-01",
        currencyCode: "EUR",
        contactName: "Org B Client",
      })
      .returning();

    getSessionMock.mockResolvedValue(ownerSession(orgAId));

    const result = await convertToInvoice(orgBQuote.id);
    expect(result.success).toBe(false);

    const [row] = await dbHolder.current
      .select()
      .from(quotes)
      .where(eq(quotes.id, orgBQuote.id));
    expect(row.status).toBe(QUOTE_STATUS.ACCEPTED);
    expect(row.invoiceId).toBeNull();
  });
});
