import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createTestDb, type TestDatabase } from "../test-utils";
import {
  expenseCategories,
  expenseGroups,
  organisations,
  users,
} from "../schema/index";
import { eq } from "drizzle-orm";

describe("expense_category schema", () => {
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
      .values({ name: "Test Org", slug: "test-org-ec" })
      .returning();
    orgId = org.id;
  });

  afterAll(async () => {
    await teardown();
  });

  it("inserts a category with valid group_code", async () => {
    const [cat] = await db
      .insert(expenseCategories)
      .values({
        orgId,
        groupCode: "rent",
        code: "office_rent",
        name: "Office Rent",
      })
      .returning();

    expect(cat.id).toBeDefined();
    expect(cat.groupCode).toBe("rent");
    expect(cat.code).toBe("office_rent");
    expect(cat.name).toBe("Office Rent");
    expect(cat.active).toBe(true);
    expect(cat.isDefault).toBe(false);
  });

  it("rejects a category with invalid group_code (FK violation)", async () => {
    await expect(
      db.insert(expenseCategories).values({
        orgId,
        groupCode: "nonexistent_group",
        code: "bad_cat",
        name: "Bad Category",
      }),
    ).rejects.toThrow();
  });

  it("enforces unique constraint on (org_id, code)", async () => {
    await db.insert(expenseCategories).values({
      orgId,
      groupCode: "utilities",
      code: "unique_test",
      name: "First",
    });

    await expect(
      db.insert(expenseCategories).values({
        orgId,
        groupCode: "utilities",
        code: "unique_test",
        name: "Duplicate",
      }),
    ).rejects.toThrow();
  });

  it("cascades delete when org is deleted", async () => {
    const [tempOrg] = await db
      .insert(organisations)
      .values({ name: "Temp Org", slug: "temp-org-ec" })
      .returning();

    await db.insert(expenseCategories).values({
      orgId: tempOrg.id,
      groupCode: "software",
      code: "temp_sw",
      name: "Temp Software",
    });

    await db.delete(organisations).where(eq(organisations.id, tempOrg.id));

    const remaining = await db
      .select()
      .from(expenseCategories)
      .where(eq(expenseCategories.orgId, tempOrg.id));

    expect(remaining.length).toBe(0);
  });

  it("sets isDefault flag per category", async () => {
    const [cat] = await db
      .insert(expenseCategories)
      .values({
        orgId,
        groupCode: "travel",
        code: "default_travel",
        name: "Travel Default",
        isDefault: true,
      })
      .returning();

    expect(cat.isDefault).toBe(true);
  });

  it("allows multiple categories with the same group_code in one org", async () => {
    await db.insert(expenseCategories).values({
      orgId,
      groupCode: "marketing",
      code: "mkt_online",
      name: "Online Marketing",
    });

    const [cat2] = await db
      .insert(expenseCategories)
      .values({
        orgId,
        groupCode: "marketing",
        code: "mkt_print",
        name: "Print Marketing",
      })
      .returning();

    expect(cat2.groupCode).toBe("marketing");
  });
});
