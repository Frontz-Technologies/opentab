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
  expenseGroups,
  expenseCategories,
  expenses,
} from "@opentab/db/schema";

// Regression: the form's free-input supplier name was silently dropped
// before the INSERT in createDraftExpense, so the expense row's
// contactName ended up NULL — list/detail then rendered "—" for any
// expense the user typed a supplier name on without picking a contact.
// Asymmetric with updateExpense, which preserved the form value.
//
// These tests freeze: free-input supplier name reaches the DB; linked
// contact still wins canonically; AI/tool callers that omit the field
// still get the contact-derived snapshot they relied on.

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

vi.mock("@/lib/expenses/category-seed", () => ({
  ensureCategoriesSeeded: vi.fn().mockResolvedValue(undefined),
}));

import { createExpense } from "@/app/(app)/expenses/actions";
import { createDraftExpense } from "@/lib/expenses/draft-expenses";

describe("expenses — contactName snapshot semantics", () => {
  let teardown: () => Promise<void>;
  let orgId: string;
  let categoryId: string;
  let contactId: string;

  beforeAll(async () => {
    const ctx = await createTestDb();
    dbHolder.current = ctx.db;
    teardown = ctx.teardown;

    const [org] = await ctx.db
      .insert(organisations)
      .values({
        name: "Org",
        slug: "org-contactname-test",
        countryCode: "GR",
      })
      .returning();
    orgId = org.id;

    await ctx.db
      .insert(expenseGroups)
      .values({ code: "other", nameEn: "Other" })
      .onConflictDoNothing();

    const [cat] = await ctx.db
      .insert(expenseCategories)
      .values({
        orgId,
        groupCode: "other",
        code: "OFFICE",
        name: "Office",
      })
      .returning();
    categoryId = cat.id;

    const [contact] = await ctx.db
      .insert(contacts)
      .values({
        orgId,
        type: "supplier",
        classification: "business",
        displayName: "Linked Supplier Ltd",
      })
      .returning();
    contactId = contact.id;
  });

  afterAll(async () => {
    await teardown();
  });

  beforeEach(() => {
    getSessionMock.mockReset();
    getSessionMock.mockResolvedValue({
      user: { id: "u1", email: "u1@e", name: "U", locale: "en" },
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
    });
  });

  function makeFormData(overrides: Record<string, string> = {}): FormData {
    const fd = new FormData();
    fd.set("expenseDate", "2026-04-02");
    fd.set("currencyCode", "EUR");
    fd.set("categoryId", categoryId);
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
    for (const [k, v] of Object.entries(overrides)) fd.set(k, v);
    return fd;
  }

  it("free-input supplier name (no contactId) is persisted to expenses.contactName", async () => {
    const fd = makeFormData({ contactName: "Acme Free-Input Co" });

    const result = await createExpense(fd);
    expect(result.success).toBe(true);

    const rows = await dbHolder.current
      .select({
        contactName: expenses.contactName,
        contactId: expenses.contactId,
      })
      .from(expenses)
      .where(eq(expenses.orgId, orgId));
    const row = rows.at(-1);
    expect(row?.contactName).toBe("Acme Free-Input Co");
    expect(row?.contactId).toBeNull();
  });

  it("linked contact's displayName is persisted as the snapshot when contactId is set", async () => {
    const fd = makeFormData({
      contactId,
      contactName: "Linked Supplier Ltd",
    });

    const result = await createExpense(fd);
    expect(result.success).toBe(true);

    const rows = await dbHolder.current
      .select({
        contactName: expenses.contactName,
        contactId: expenses.contactId,
      })
      .from(expenses)
      .where(eq(expenses.contactId, contactId));
    const row = rows.at(-1);
    expect(row?.contactName).toBe("Linked Supplier Ltd");
    expect(row?.contactId).toBe(contactId);
  });

  it("createDraftExpense called without contactName falls back to the linked contact's displayName", async () => {
    const { expense } = await createDraftExpense(orgId, {
      contactId,
      categoryId,
      expenseDate: "2026-04-03",
      currencyCode: "EUR",
      usesInclusiveTax: false,
      items: [
        {
          sortOrder: 0,
          name: "Item",
          description: "",
          quantity: "1",
          unitPrice: "10.00",
          taxRate: "0.00",
        },
      ],
    });

    const [row] = await dbHolder.current
      .select({ contactName: expenses.contactName })
      .from(expenses)
      .where(eq(expenses.id, expense.id));
    expect(row?.contactName).toBe("Linked Supplier Ltd");
  });

  it("createDraftExpense with no contactId and no contactName writes NULL (no fabricated value)", async () => {
    const { expense } = await createDraftExpense(orgId, {
      contactId: "",
      categoryId,
      expenseDate: "2026-04-04",
      currencyCode: "EUR",
      usesInclusiveTax: false,
      items: [
        {
          sortOrder: 0,
          name: "Item",
          description: "",
          quantity: "1",
          unitPrice: "10.00",
          taxRate: "0.00",
        },
      ],
    });

    const [row] = await dbHolder.current
      .select({ contactName: expenses.contactName })
      .from(expenses)
      .where(eq(expenses.id, expense.id));
    expect(row?.contactName).toBeNull();
  });
});
