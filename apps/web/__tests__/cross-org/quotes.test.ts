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
  quotes,
  QUOTE_STATUS,
} from "@opentab/db/schema";

// Issue #274 (Phase B) — defence-in-depth on quotes/actions.ts.
// convertToInvoice's UPDATE used `eq(quotes.id, id)` only; the
// pre-check at the top of the action gated authorisation, but
// every other quote mutation in the file already paired
// `eq(quotes.id, id)` AND `eq(quotes.orgId, session.org.id)` on
// the WHERE. The fix aligns convertToInvoice with the rest of
// the file.

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

import { convertToInvoice } from "@/app/(app)/quotes/actions";

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
