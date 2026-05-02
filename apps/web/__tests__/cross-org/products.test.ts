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
import { organisations, products } from "@opentab/db/schema";

// Cross-org isolation for the products table. All read/write call
// sites against `product` pair `eq(products.id, …)` AND
// `eq(products.orgId, session.org.id)` on their WHERE. These tests
// freeze that contract for `updateProduct` and `deleteProduct` so a
// future regression that drops the orgId clause would surface here,
// not in production.

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

import { updateProduct, deleteProduct } from "@/app/(app)/products/actions";

describe("products actions — cross-org isolation", () => {
  let teardown: () => Promise<void>;
  let orgAId: string;
  let orgBId: string;

  beforeAll(async () => {
    const ctx = await createTestDb();
    dbHolder.current = ctx.db;
    teardown = ctx.teardown;

    const [a] = await ctx.db
      .insert(organisations)
      .values({ name: "Org A", slug: "org-a-products-274", countryCode: "GR" })
      .returning();
    const [b] = await ctx.db
      .insert(organisations)
      .values({ name: "Org B", slug: "org-b-products-274", countryCode: "GR" })
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

  it("updateProduct from Org A does not mutate Org B's product", async () => {
    const [orgBProduct] = await dbHolder.current
      .insert(products)
      .values({
        orgId: orgBId,
        name: "Org B Confidential Service",
        description: "private B description",
        unitPrice: "100.00",
        unit: "hour",
        taxCategory: "standard",
        active: true,
      })
      .returning();

    getSessionMock.mockResolvedValue(ownerSession(orgAId));

    const fd = new FormData();
    fd.set("name", "Hijacked by A");
    fd.set("description", "leaked");
    fd.set("unitPrice", "1.00");
    fd.set("unit", "item");
    fd.set("taxCategory", "standard");
    fd.set("active", "false");

    const result = await updateProduct(orgBProduct.id, fd);
    // The action returns success=true for the no-op (UPDATE matched
    // zero rows because the orgId clause filtered Org B's row out).
    // What matters is the row in DB stayed untouched.
    expect(result.success).toBe(true);

    const [row] = await dbHolder.current
      .select()
      .from(products)
      .where(eq(products.id, orgBProduct.id));
    expect(row.name).toBe("Org B Confidential Service");
    expect(row.description).toBe("private B description");
    expect(row.unitPrice).toBe("100.00");
    expect(row.active).toBe(true);
  });

  it("deleteProduct from Org A does not delete Org B's product", async () => {
    const [orgBProduct] = await dbHolder.current
      .insert(products)
      .values({
        orgId: orgBId,
        name: "Org B Survivor",
        unitPrice: "50.00",
        unit: "item",
        taxCategory: "standard",
        active: true,
      })
      .returning();

    getSessionMock.mockResolvedValue(ownerSession(orgAId));

    const result = await deleteProduct(orgBProduct.id);
    expect(result.success).toBe(true);

    const rows = await dbHolder.current
      .select()
      .from(products)
      .where(eq(products.id, orgBProduct.id));
    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe("Org B Survivor");
  });

  it("deleteProduct from Org B does delete Org B's product (sanity)", async () => {
    const [orgBProduct] = await dbHolder.current
      .insert(products)
      .values({
        orgId: orgBId,
        name: "Org B Goner",
        unitPrice: "10.00",
        unit: "item",
        taxCategory: "standard",
        active: true,
      })
      .returning();

    getSessionMock.mockResolvedValue(ownerSession(orgBId));

    const result = await deleteProduct(orgBProduct.id);
    expect(result.success).toBe(true);

    const rows = await dbHolder.current
      .select()
      .from(products)
      .where(eq(products.id, orgBProduct.id));
    expect(rows).toHaveLength(0);
  });
});
