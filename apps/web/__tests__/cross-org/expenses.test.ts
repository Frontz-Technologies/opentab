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

// Write-side FK validation. The createDraftExpense / updateExpense
// paths must reject any UUID on `contactId` and `categoryId` that
// does not belong to the caller's org. Without a same-org pre-check,
// a crafted form payload could either trip the FK constraint (opaque
// crash) or — for the nullable categoryId on a real existing row —
// silently link the expense to another org's category.
//
// These tests freeze the contract: cross-org FK refused, same-org
// flow still succeeds.

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

// createExpense seeds categories on first run; the real seed reads a
// large fixture per countryCode. Stub it to a no-op so the test only
// exercises the FK guard.
vi.mock("@/lib/expenses/category-seed", () => ({
  ensureCategoriesSeeded: vi.fn().mockResolvedValue(undefined),
}));

import { createExpense, updateExpense } from "@/app/(app)/expenses/actions";

describe("expenses actions — write-side FK validation (#274)", () => {
  let teardown: () => Promise<void>;
  let orgAId: string;
  let orgBId: string;
  let orgACategoryId: string;
  let orgBCategoryId: string;
  let orgAContactId: string;
  let orgBContactId: string;

  beforeAll(async () => {
    const ctx = await createTestDb();
    dbHolder.current = ctx.db;
    teardown = ctx.teardown;

    const [a] = await ctx.db
      .insert(organisations)
      .values({ name: "Org A", slug: "org-a-exp-274", countryCode: "GR" })
      .returning();
    const [b] = await ctx.db
      .insert(organisations)
      .values({ name: "Org B", slug: "org-b-exp-274", countryCode: "GR" })
      .returning();
    orgAId = a.id;
    orgBId = b.id;

    await ctx.db
      .insert(expenseGroups)
      .values({ code: "other", nameEn: "Other" })
      .onConflictDoNothing();

    const [catA] = await ctx.db
      .insert(expenseCategories)
      .values({
        orgId: orgAId,
        groupCode: "other",
        code: "A-EXP-CAT",
        name: "Org A Cat",
      })
      .returning();
    const [catB] = await ctx.db
      .insert(expenseCategories)
      .values({
        orgId: orgBId,
        groupCode: "other",
        code: "B-EXP-CAT",
        name: "Org B Cat",
      })
      .returning();
    orgACategoryId = catA.id;
    orgBCategoryId = catB.id;

    const [contactA] = await ctx.db
      .insert(contacts)
      .values({
        orgId: orgAId,
        type: "supplier",
        classification: "business",
        displayName: "Org A Supplier",
      })
      .returning();
    const [contactB] = await ctx.db
      .insert(contacts)
      .values({
        orgId: orgBId,
        type: "supplier",
        classification: "business",
        displayName: "Org B Supplier",
      })
      .returning();
    orgAContactId = contactA.id;
    orgBContactId = contactB.id;
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

  function makeFormData(overrides: Record<string, string> = {}): FormData {
    const fd = new FormData();
    fd.set("expenseDate", "2026-04-02");
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
    for (const [k, v] of Object.entries(overrides)) fd.set(k, v);
    return fd;
  }

  it("createExpense refuses a cross-org categoryId from Org A's session", async () => {
    getSessionMock.mockResolvedValue(ownerSession(orgAId));

    const fd = makeFormData({ categoryId: orgBCategoryId });

    // The FK guard throws cross-org-access from createDraftExpense;
    // the action layer doesn't catch it, so it propagates.
    await expect(createExpense(fd)).rejects.toThrow(/cross-org-access/);

    // Sanity: no Org A expense was inserted.
    const orgARows = await dbHolder.current
      .select()
      .from(expenses)
      .where(eq(expenses.orgId, orgAId));
    expect(orgARows).toHaveLength(0);
  });

  it("createExpense succeeds with a same-org categoryId", async () => {
    getSessionMock.mockResolvedValue(ownerSession(orgAId));

    const fd = makeFormData({ categoryId: orgACategoryId });
    const result = await createExpense(fd);
    expect(result.success).toBe(true);
  });

  it("updateExpense refuses a cross-org contactId on an Org A expense", async () => {
    // Seed an Org A expense first.
    const [expense] = await dbHolder.current
      .insert(expenses)
      .values({
        orgId: orgAId,
        expenseNumber: "EXP-A-274-01",
        expenseDate: "2026-04-01",
        currencyCode: "EUR",
      })
      .returning();
    getSessionMock.mockResolvedValue(ownerSession(orgAId));

    const fd = new FormData();
    fd.set("contactId", orgBContactId); // CROSS-ORG FK
    fd.set("expenseDate", "2026-04-03");
    fd.set("currencyCode", "EUR");
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

    const result = await updateExpense(expense.id, fd);
    expect(result.success).toBe(false);

    // Org A's expense.contactId was not flipped to Org B's contact.
    const [row] = await dbHolder.current
      .select()
      .from(expenses)
      .where(eq(expenses.id, expense.id));
    expect(row.contactId).not.toBe(orgBContactId);
  });

  it("updateExpense refuses a cross-org categoryId on an Org A expense", async () => {
    const [expense] = await dbHolder.current
      .insert(expenses)
      .values({
        orgId: orgAId,
        expenseNumber: "EXP-A-274-02",
        expenseDate: "2026-04-01",
        currencyCode: "EUR",
      })
      .returning();
    getSessionMock.mockResolvedValue(ownerSession(orgAId));

    const fd = new FormData();
    fd.set("categoryId", orgBCategoryId); // CROSS-ORG FK
    fd.set("expenseDate", "2026-04-03");
    fd.set("currencyCode", "EUR");
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

    const result = await updateExpense(expense.id, fd);
    expect(result.success).toBe(false);

    const [row] = await dbHolder.current
      .select()
      .from(expenses)
      .where(eq(expenses.id, expense.id));
    expect(row.categoryId).not.toBe(orgBCategoryId);
  });
});
