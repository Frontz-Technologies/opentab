import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createTestDb, type TestDatabase } from "../test-utils";
import { products, organisations, users } from "../schema/index";
import { eq } from "drizzle-orm";

describe("products schema", () => {
  let db: TestDatabase;
  let teardown: () => Promise<void>;
  let orgId: string;

  beforeAll(async () => {
    const result = await createTestDb();
    db = result.db;
    teardown = result.teardown;

    await db.insert(users).values({
      id: "user-1",
      email: "test@example.com",
      name: "Test User",
    });

    const [org] = await db
      .insert(organisations)
      .values({ name: "Test Org", slug: "test-org" })
      .returning();
    orgId = org.id;
  });

  afterAll(async () => {
    await teardown();
  });

  it("creates a product with default values", async () => {
    const [product] = await db
      .insert(products)
      .values({
        orgId,
        name: "Web Development",
        unitPrice: "100.00",
        unit: "hour",
        taxCategory: "standard",
      })
      .returning();

    expect(product.name).toBe("Web Development");
    expect(product.unitPrice).toBe("100.00");
    expect(product.unit).toBe("hour");
    expect(product.taxCategory).toBe("standard");
    expect(product.active).toBe(true);
  });

  it("creates a product with all fields", async () => {
    const [product] = await db
      .insert(products)
      .values({
        orgId,
        name: "Hosting Service",
        description: "Monthly web hosting",
        unitPrice: "29.99",
        unit: "service",
        taxCategory: "standard",
        vatRate: "24.00",
      })
      .returning();

    expect(product.description).toBe("Monthly web hosting");
    expect(product.vatRate).toBe("24.00");
  });

  it("creates an exempt product", async () => {
    const [product] = await db
      .insert(products)
      .values({
        orgId,
        name: "Education Course",
        unitPrice: "500.00",
        unit: "item",
        taxCategory: "exempt",
        vatRate: "0.00",
      })
      .returning();

    expect(product.taxCategory).toBe("exempt");
  });

  it("filters products by org and active status", async () => {
    await db.insert(products).values({
      orgId,
      name: "Inactive Product",
      unitPrice: "10.00",
      unit: "item",
      taxCategory: "standard",
      active: false,
    });

    const activeProducts = await db
      .select()
      .from(products)
      .where(eq(products.orgId, orgId));

    const active = activeProducts.filter((p) => p.active);
    const inactive = activeProducts.filter((p) => !p.active);

    expect(active.length).toBeGreaterThan(0);
    expect(inactive.length).toBeGreaterThan(0);
  });

  it("cascades delete when org is deleted", async () => {
    const [tempOrg] = await db
      .insert(organisations)
      .values({ name: "Temp Org", slug: "temp-product-org" })
      .returning();

    await db.insert(products).values({
      orgId: tempOrg.id,
      name: "Temp Product",
      unitPrice: "1.00",
      unit: "item",
      taxCategory: "standard",
    });

    await db.delete(organisations).where(eq(organisations.id, tempOrg.id));

    const remaining = await db
      .select()
      .from(products)
      .where(eq(products.orgId, tempOrg.id));

    expect(remaining.length).toBe(0);
  });
});
