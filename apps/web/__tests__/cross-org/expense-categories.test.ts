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
import { organisations, expenseCategories } from "@opentab/db/schema";

// Cross-org isolation for toggleCategory. The UPDATE must carry
// orgId in its WHERE alongside the id — a SELECT pre-check alone is
// not enough because of TOCTOU and because future callers may drop
// the pre-check. Defence-in-depth: every mutation must include orgId
// in its WHERE.

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

import { toggleCategory } from "@/app/(app)/expenses/categories/actions";

describe("toggleCategory — cross-org isolation", () => {
  let teardown: () => Promise<void>;
  let orgAId: string;
  let orgBId: string;
  let orgBCategoryId: string;

  beforeAll(async () => {
    const ctx = await createTestDb();
    dbHolder.current = ctx.db;
    teardown = ctx.teardown;

    const [a] = await ctx.db
      .insert(organisations)
      .values({
        name: "Org A",
        slug: "org-a-cat-274",
        countryCode: "GR",
      })
      .returning();
    const [b] = await ctx.db
      .insert(organisations)
      .values({
        name: "Org B",
        slug: "org-b-cat-274",
        countryCode: "GR",
      })
      .returning();
    orgAId = a.id;
    orgBId = b.id;

    const [orgBCat] = await ctx.db
      .insert(expenseCategories)
      .values({
        orgId: orgBId,
        groupCode: "rent",
        code: "b_rent",
        name: "Org B rent",
        active: true,
      })
      .returning();
    orgBCategoryId = orgBCat.id;
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

  it("does not toggle Org B's category when called from Org A", async () => {
    getSessionMock.mockResolvedValue(ownerSession(orgAId));

    const result = await toggleCategory(orgBCategoryId);

    // Org A doesn't own that id, so the action should refuse.
    expect(result.success).toBe(false);

    // And — critically — Org B's row stays active=true.
    const [row] = await dbHolder.current
      .select()
      .from(expenseCategories)
      .where(eq(expenseCategories.id, orgBCategoryId));
    expect(row.active).toBe(true);
  });

  it("does toggle Org B's category when called from Org B (sanity check)", async () => {
    getSessionMock.mockResolvedValue(ownerSession(orgBId));

    const result = await toggleCategory(orgBCategoryId);

    expect(result.success).toBe(true);

    const [row] = await dbHolder.current
      .select()
      .from(expenseCategories)
      .where(eq(expenseCategories.id, orgBCategoryId));
    expect(row.active).toBe(false);
  });
});

// expenses/[id]/page.tsx category-name lookup. The page selects
// expense_category.name by id with no orgId scope. If an attacker
// (Org A) somehow holds an expense whose categoryId references an
// Org B category, the join would leak Org B's category name into
// Org A's UI. The fix scopes the lookup by session.org.id, so the
// resulting categoryName is null when the row belongs to another org.
describe("expense detail page category lookup — cross-org isolation", () => {
  let teardown: () => Promise<void>;
  let db: Awaited<ReturnType<typeof createTestDb>>["db"];
  let orgAId: string;
  let orgBId: string;
  let orgBCategoryId: string;

  beforeAll(async () => {
    const ctx = await createTestDb();
    db = ctx.db;
    teardown = ctx.teardown;

    const [a] = await db
      .insert(organisations)
      .values({
        name: "Org A",
        slug: "org-a-detail-cat-274",
        countryCode: "GR",
      })
      .returning();
    const [b] = await db
      .insert(organisations)
      .values({
        name: "Org B",
        slug: "org-b-detail-cat-274",
        countryCode: "GR",
      })
      .returning();
    orgAId = a.id;
    orgBId = b.id;

    const [orgBCat] = await db
      .insert(expenseCategories)
      .values({
        orgId: orgBId,
        groupCode: "rent",
        code: "b_rent_detail",
        name: "Org B Confidential Rent",
      })
      .returning();
    orgBCategoryId = orgBCat.id;
  });

  afterAll(async () => {
    await teardown();
  });

  it("scoped lookup returns nothing when categoryId belongs to another org", async () => {
    // Mirror the exact query shape used in expenses/[id]/page.tsx after
    // the fix: WHERE id = X AND orgId = session.org.id.
    const { and: drizzleAnd, eq: drizzleEq } = await import("drizzle-orm");
    const rows = await db
      .select()
      .from(expenseCategories)
      .where(
        drizzleAnd(
          drizzleEq(expenseCategories.id, orgBCategoryId),
          drizzleEq(expenseCategories.orgId, orgAId),
        ),
      );

    expect(rows).toHaveLength(0);
  });

  it("unscoped lookup (the OLD bug) would have leaked the name — proves the test is meaningful", async () => {
    const rows = await db
      .select()
      .from(expenseCategories)
      .where(eq(expenseCategories.id, orgBCategoryId));

    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe("Org B Confidential Rent");
  });
});
