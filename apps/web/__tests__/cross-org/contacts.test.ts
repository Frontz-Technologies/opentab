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
import { organisations, contacts } from "@opentab/db/schema";

// Issue #274 (Phase C) — cross-org isolation for the contacts table.
// All read/write call sites against `contact` already pair
// `eq(contacts.id, …)` AND `eq(contacts.orgId, session.org.id)` on
// their WHERE. These tests freeze that contract for `updateContact`
// and `deleteContact` so a future regression that drops the orgId
// clause would surface here, not in production.

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

import { updateContact, deleteContact } from "@/app/(app)/contacts/actions";

describe("contacts actions — cross-org isolation (#274)", () => {
  let teardown: () => Promise<void>;
  let orgAId: string;
  let orgBId: string;

  beforeAll(async () => {
    const ctx = await createTestDb();
    dbHolder.current = ctx.db;
    teardown = ctx.teardown;

    const [a] = await ctx.db
      .insert(organisations)
      .values({ name: "Org A", slug: "org-a-contacts-274", countryCode: "GR" })
      .returning();
    const [b] = await ctx.db
      .insert(organisations)
      .values({ name: "Org B", slug: "org-b-contacts-274", countryCode: "GR" })
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

  it("updateContact from Org A does not mutate Org B's contact", async () => {
    const [orgBContact] = await dbHolder.current
      .insert(contacts)
      .values({
        orgId: orgBId,
        type: "client",
        classification: "business",
        company: "Org B Confidential",
        displayName: "Org B Confidential",
        notes: "private B notes",
      })
      .returning();

    getSessionMock.mockResolvedValue(ownerSession(orgAId));

    const fd = new FormData();
    fd.set("type", "client");
    fd.set("classification", "business");
    fd.set("company", "Hijacked by A");
    fd.set("firstName", "");
    fd.set("lastName", "");
    fd.set("email", "");
    fd.set("phone", "");
    fd.set("vatNumber", "");
    fd.set("countryCode", "");
    fd.set("taxOffice", "");
    fd.set("addressLine1", "");
    fd.set("addressLine2", "");
    fd.set("city", "");
    fd.set("postalCode", "");
    fd.set("region", "");
    fd.set("defaultCurrency", "");
    fd.set("defaultLanguage", "");
    fd.set("notes", "leaked");

    const result = await updateContact(orgBContact.id, fd);
    // The action returns success=true for the no-op (UPDATE matched
    // zero rows because the orgId clause filtered Org B's row out).
    // What matters is the row in DB stayed untouched.
    expect(result.success).toBe(true);

    const [row] = await dbHolder.current
      .select()
      .from(contacts)
      .where(eq(contacts.id, orgBContact.id));
    expect(row.company).toBe("Org B Confidential");
    expect(row.notes).toBe("private B notes");
  });

  it("deleteContact from Org A does not delete Org B's contact", async () => {
    const [orgBContact] = await dbHolder.current
      .insert(contacts)
      .values({
        orgId: orgBId,
        type: "client",
        classification: "business",
        company: "Org B Survivor",
        displayName: "Org B Survivor",
      })
      .returning();

    getSessionMock.mockResolvedValue(ownerSession(orgAId));

    const result = await deleteContact(orgBContact.id);
    expect(result.success).toBe(true);

    const rows = await dbHolder.current
      .select()
      .from(contacts)
      .where(eq(contacts.id, orgBContact.id));
    expect(rows).toHaveLength(1);
    expect(rows[0].company).toBe("Org B Survivor");
  });

  it("deleteContact from Org B does delete Org B's contact (sanity)", async () => {
    const [orgBContact] = await dbHolder.current
      .insert(contacts)
      .values({
        orgId: orgBId,
        type: "client",
        classification: "business",
        company: "Org B Goner",
        displayName: "Org B Goner",
      })
      .returning();

    getSessionMock.mockResolvedValue(ownerSession(orgBId));

    const result = await deleteContact(orgBContact.id);
    expect(result.success).toBe(true);

    const rows = await dbHolder.current
      .select()
      .from(contacts)
      .where(eq(contacts.id, orgBContact.id));
    expect(rows).toHaveLength(0);
  });
});
