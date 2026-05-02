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
  recurringInvoices,
  recurringInvoiceItems,
} from "@opentab/db/schema";

// Cross-org isolation for the recurring invoice update path.
//
// updateRecurring scopes the parent UPDATE by orgId, but the
// subsequent `delete(recurringInvoiceItems).where(recurringInvoiceId
// = id)` is unscoped — recurringInvoiceItems has no orgId column, so
// a cross-org id would no-op the parent update yet still wipe another
// org's line items via the DELETE. We pre-check that the parent
// recurring invoice belongs to the session's org before touching its
// line items (mirror of the updateInvoice shape).

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

import {
  createRecurring,
  updateRecurring,
} from "@/app/(app)/recurring/actions";

describe("updateRecurring — cross-org isolation (#274)", () => {
  let teardown: () => Promise<void>;
  let orgAId: string;
  let orgBId: string;
  let orgARawContactId: string;
  let orgBRecurringId: string;
  let orgBItemId: string;

  beforeAll(async () => {
    const ctx = await createTestDb();
    dbHolder.current = ctx.db;
    teardown = ctx.teardown;

    const [a] = await ctx.db
      .insert(organisations)
      .values({ name: "Org A", slug: "org-a-rec-274", countryCode: "GR" })
      .returning();
    const [b] = await ctx.db
      .insert(organisations)
      .values({ name: "Org B", slug: "org-b-rec-274", countryCode: "GR" })
      .returning();
    orgAId = a.id;
    orgBId = b.id;

    // The action validates contactId as a UUID, and the parent UPDATE
    // references contacts.id via FK. Without a real contact the UPDATE
    // would throw an FK violation — masking the actual bug. Provide an
    // Org A contact so the action takes the no-op-on-cross-org-id path
    // and the DELETE-without-scope bug surfaces in the items table.
    const [orgAContact] = await ctx.db
      .insert(contacts)
      .values({
        orgId: orgAId,
        type: "client",
        classification: "business",
        displayName: "Org A Client",
      })
      .returning();
    orgARawContactId = orgAContact.id;

    const [orgBContact] = await ctx.db
      .insert(contacts)
      .values({
        orgId: orgBId,
        type: "client",
        classification: "business",
        displayName: "Org B Client",
      })
      .returning();
    const [orgBRec] = await ctx.db
      .insert(recurringInvoices)
      .values({
        orgId: orgBId,
        contactId: orgBContact.id,
        startDate: "2026-04-01",
        nextSendDate: "2026-05-01",
      })
      .returning();
    orgBRecurringId = orgBRec.id;
    const [orgBItem] = await ctx.db
      .insert(recurringInvoiceItems)
      .values({
        recurringInvoiceId: orgBRec.id,
        name: "Org B item",
        quantity: "1",
        unitPrice: "100.00",
        taxRate: "24.00",
        taxAmount: "24.00",
        lineTotal: "124.00",
      })
      .returning();
    orgBItemId = orgBItem.id;
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

  it("createRecurring refuses an Org B contactId from Org A's session (#274 carry-over)", async () => {
    const [orgBContact] = await dbHolder.current
      .insert(contacts)
      .values({
        orgId: orgBId,
        type: "client",
        classification: "business",
        displayName: "Org B Foreign Client",
      })
      .returning();
    getSessionMock.mockResolvedValue(ownerSession(orgAId));

    const fd = new FormData();
    fd.set("contactId", orgBContact.id); // CROSS-ORG FK
    fd.set("frequency", "4");
    fd.set("startDate", "2026-04-02");
    fd.set("nextSendDate", "2026-05-02");
    fd.set("currencyCode", "EUR");
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

    const result = await createRecurring(fd);
    expect(result.success).toBe(false);

    const orgARows = await dbHolder.current
      .select()
      .from(recurringInvoices)
      .where(eq(recurringInvoices.orgId, orgAId));
    expect(orgARows).toHaveLength(0);
  });

  it("createRecurring refuses a cross-org productId in line items (#274 carry-over)", async () => {
    const [orgBProduct] = await dbHolder.current
      .insert(products)
      .values({ orgId: orgBId, name: "Org B Recurring Product" })
      .returning();
    getSessionMock.mockResolvedValue(ownerSession(orgAId));

    const fd = new FormData();
    fd.set("contactId", orgARawContactId); // same-org
    fd.set("frequency", "4");
    fd.set("startDate", "2026-04-02");
    fd.set("nextSendDate", "2026-05-02");
    fd.set("currencyCode", "EUR");
    fd.set(
      "items",
      JSON.stringify([
        {
          productId: orgBProduct.id, // cross-org line FK
          sortOrder: 0,
          name: "Item",
          quantity: "1",
          unitPrice: "10.00",
          taxRate: "0.00",
        },
      ]),
    );

    const result = await createRecurring(fd);
    expect(result.success).toBe(false);
  });

  it("Org A calling updateRecurring with Org B's id does NOT wipe Org B's items", async () => {
    getSessionMock.mockResolvedValue(ownerSession(orgAId));

    const fd = new FormData();
    fd.set("contactId", orgARawContactId);
    fd.set("frequency", "4");
    fd.set("startDate", "2026-04-01");
    fd.set("nextSendDate", "2026-05-01");
    fd.set("currencyCode", "EUR");
    fd.set(
      "items",
      JSON.stringify([
        {
          sortOrder: 0,
          name: "Attacker item",
          quantity: "1",
          unitPrice: "1.00",
          taxRate: "0.00",
        },
      ]),
    );

    const result = await updateRecurring(orgBRecurringId, fd);
    expect(result.success).toBe(false);

    // Org B's line item must still be there — the old bug would have
    // deleted it.
    const items = await dbHolder.current
      .select()
      .from(recurringInvoiceItems)
      .where(eq(recurringInvoiceItems.id, orgBItemId));
    expect(items).toHaveLength(1);
    expect(items[0].name).toBe("Org B item");

    // And: no Org A row was inserted into Org B's recurring invoice.
    const allItems = await dbHolder.current
      .select()
      .from(recurringInvoiceItems)
      .where(eq(recurringInvoiceItems.recurringInvoiceId, orgBRecurringId));
    expect(allItems).toHaveLength(1);
    expect(allItems[0].name).toBe("Org B item");
  });
});
