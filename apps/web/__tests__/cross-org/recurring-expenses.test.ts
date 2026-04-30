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
  recurringExpenses,
  recurringExpenseItems,
} from "@opentab/db/schema";

// Issue #274 (Phase D) — recurring expense update path.
// Same shape as the recurring invoices fix: the parent UPDATE was
// scoped, but the line-item DELETE was not. Pre-check the parent
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

import { updateRecurringExpense } from "@/app/(app)/recurring-expenses/actions";

describe("updateRecurringExpense — cross-org isolation (#274)", () => {
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
