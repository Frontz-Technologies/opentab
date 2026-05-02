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
  expenseCategories,
  expenseGroups,
  recurringExpenses,
  recurringExpenseItems,
} from "@opentab/db/schema";

// Cross-org isolation for the recurring expense update path. Same
// shape as recurring invoices: the parent UPDATE is scoped by orgId,
// but the line-item DELETE is not — so we pre-check that the parent
// belongs to the session's org before touching items.

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
  createRecurringExpense,
  updateRecurringExpense,
} from "@/app/(app)/recurring-expenses/actions";

describe("updateRecurringExpense — cross-org isolation", () => {
  let teardown: () => Promise<void>;
  let orgAId: string;
  let orgBId: string;
  let orgBRecId: string;
  let orgBItemId: string;

  beforeAll(async () => {
    const ctx = await createTestDb();
    dbHolder.current = ctx.db;
    teardown = ctx.teardown;

    const [a] = await ctx.db
      .insert(organisations)
      .values({ name: "Org A", slug: "org-a-rex-274", countryCode: "GR" })
      .returning();
    const [b] = await ctx.db
      .insert(organisations)
      .values({ name: "Org B", slug: "org-b-rex-274", countryCode: "GR" })
      .returning();
    orgAId = a.id;
    orgBId = b.id;

    const [orgBRec] = await ctx.db
      .insert(recurringExpenses)
      .values({
        orgId: orgBId,
        startDate: "2026-04-01",
        nextRunDate: "2026-05-01",
      })
      .returning();
    orgBRecId = orgBRec.id;
    const [orgBItem] = await ctx.db
      .insert(recurringExpenseItems)
      .values({
        recurringExpenseId: orgBRec.id,
        name: "Org B expense item",
        quantity: "1",
        unitPrice: "50.00",
        taxRate: "24.00",
        taxAmount: "12.00",
        lineTotal: "62.00",
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

  it("createRecurringExpense refuses an Org B contactId from Org A's session", async () => {
    const [orgBContact] = await dbHolder.current
      .insert(contacts)
      .values({
        orgId: orgBId,
        type: "supplier",
        classification: "business",
        displayName: "Org B Foreign Supplier",
      })
      .returning();
    getSessionMock.mockResolvedValue(ownerSession(orgAId));

    const fd = new FormData();
    fd.set("contactId", orgBContact.id); // CROSS-ORG FK
    fd.set("frequency", "4");
    fd.set("startDate", "2026-04-01");
    fd.set("nextRunDate", "2026-05-01");
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

    const result = await createRecurringExpense(fd);
    expect(result.success).toBe(false);

    // No Org A recurring expense was created.
    const orgARows = await dbHolder.current
      .select()
      .from(recurringExpenses)
      .where(eq(recurringExpenses.orgId, orgAId));
    expect(orgARows).toHaveLength(0);
  });

  it("createRecurringExpense refuses an Org B categoryId from Org A's session", async () => {
    // Seed expense category in Org B.
    await dbHolder.current
      .insert(expenseGroups)
      .values({ code: "other", nameEn: "Other" })
      .onConflictDoNothing();
    const [orgBCat] = await dbHolder.current
      .insert(expenseCategories)
      .values({
        orgId: orgBId,
        groupCode: "other",
        code: "B-CAT-FK",
        name: "Org B Cat",
      })
      .returning();

    getSessionMock.mockResolvedValue(ownerSession(orgAId));

    const fd = new FormData();
    fd.set("categoryId", orgBCat.id); // CROSS-ORG FK
    fd.set("frequency", "4");
    fd.set("startDate", "2026-04-01");
    fd.set("nextRunDate", "2026-05-01");
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

    const result = await createRecurringExpense(fd);
    expect(result.success).toBe(false);
  });

  it("Org A calling updateRecurringExpense with Org B's id does NOT wipe Org B's items", async () => {
    getSessionMock.mockResolvedValue(ownerSession(orgAId));

    const fd = new FormData();
    fd.set("frequency", "4");
    fd.set("startDate", "2026-04-01");
    fd.set("nextRunDate", "2026-05-01");
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

    const result = await updateRecurringExpense(orgBRecId, fd);
    expect(result.success).toBe(false);

    const items = await dbHolder.current
      .select()
      .from(recurringExpenseItems)
      .where(eq(recurringExpenseItems.id, orgBItemId));
    expect(items).toHaveLength(1);
    expect(items[0].name).toBe("Org B expense item");

    const allItems = await dbHolder.current
      .select()
      .from(recurringExpenseItems)
      .where(eq(recurringExpenseItems.recurringExpenseId, orgBRecId));
    expect(allItems).toHaveLength(1);
    expect(allItems[0].name).toBe("Org B expense item");
  });
});
