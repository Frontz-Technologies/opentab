import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { eq } from "drizzle-orm";
import { createTestDb } from "@opentab/db/test-utils";
import {
  organisations,
  contacts,
  products,
  invoices,
  expenses,
  expenseCategories,
} from "@opentab/db/schema";
import { populateOrgDemo } from "../lib/demo/populate";
import { DEMO_ORG } from "../lib/demo/data-pool";

describe("populateOrgDemo count invariant", () => {
  let db: Awaited<ReturnType<typeof createTestDb>>["db"];
  let teardown: () => Promise<void>;

  beforeAll(async () => {
    const ctx = await createTestDb();
    db = ctx.db;
    teardown = ctx.teardown;
  });

  afterAll(async () => {
    await teardown();
  });

  it("actual row counts match declared PopulateResult for every seeded entity", async () => {
    const [org] = await db
      .insert(organisations)
      .values({
        name: DEMO_ORG.name,
        slug: `${DEMO_ORG.slug}-count-invariant`,
        countryCode: DEMO_ORG.countryCode,
        defaultCurrency: DEMO_ORG.defaultCurrency,
      })
      .returning();

    const result = await populateOrgDemo(db, org.id);

    const contactRows = await db
      .select({ id: contacts.id })
      .from(contacts)
      .where(eq(contacts.orgId, org.id));
    const productRows = await db
      .select({ id: products.id })
      .from(products)
      .where(eq(products.orgId, org.id));
    const invoiceRows = await db
      .select({ id: invoices.id })
      .from(invoices)
      .where(eq(invoices.orgId, org.id));
    const expenseRows = await db
      .select({ id: expenses.id })
      .from(expenses)
      .where(eq(expenses.orgId, org.id));

    expect(contactRows.length).toBe(result.contactCount);
    expect(productRows.length).toBe(result.productCount);
    expect(invoiceRows.length).toBe(result.invoiceCount);
    expect(expenseRows.length).toBe(result.expenseCount);
    // Guards the original silent-skip bug — seedExpenses must not produce 0.
    expect(expenseRows.length).toBeGreaterThan(0);
  });

  it("seeds expense categories as a side effect (fixes zero-expenses bug)", async () => {
    const [org] = await db
      .insert(organisations)
      .values({
        name: DEMO_ORG.name,
        slug: `${DEMO_ORG.slug}-cat-seed`,
        countryCode: DEMO_ORG.countryCode,
        defaultCurrency: DEMO_ORG.defaultCurrency,
      })
      .returning();

    await populateOrgDemo(db, org.id);

    const cats = await db
      .select()
      .from(expenseCategories)
      .where(eq(expenseCategories.orgId, org.id));
    // GR pack defines 20 categories (see apps/web/lib/expenses/category-seed.ts).
    expect(cats.length).toBeGreaterThanOrEqual(20);
  });
});
