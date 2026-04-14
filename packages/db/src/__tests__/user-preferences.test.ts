import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { createTestDb, type TestDatabase } from "../test-utils";
import { users, userPreferences } from "../schema/index";

describe("UserPreferences", () => {
  let db: TestDatabase;
  let teardown: () => Promise<void>;

  beforeAll(async () => {
    const result = await createTestDb();
    db = result.db;
    teardown = result.teardown;
  });

  afterAll(async () => {
    await teardown();
  });

  it("creates preferences for a user with defaults", async () => {
    await db.insert(users).values({
      id: "test-user-prefs-1",
      email: "prefs@test.com",
      name: "Test User",
    });

    const [prefs] = await db
      .insert(userPreferences)
      .values({ userId: "test-user-prefs-1" })
      .returning();

    expect(prefs.locale).toBe("en");
    expect(prefs.dateFormat).toBe("DD/MM/YYYY");
    expect(prefs.numberFormat).toBe("eu");
    expect(prefs.theme).toBe("dark");
    expect(prefs.density).toBe("comfortable");
    expect(prefs.notifyInvoicePaid).toBe(true);
    expect(prefs.notifyExpenseApproved).toBe(true);
  });

  it("enforces unique user_id constraint", async () => {
    await db.insert(users).values({
      id: "test-user-prefs-2",
      email: "prefs2@test.com",
      name: "Test User 2",
    });

    await db.insert(userPreferences).values({ userId: "test-user-prefs-2" });

    await expect(
      db.insert(userPreferences).values({ userId: "test-user-prefs-2" }),
    ).rejects.toThrow();
  });

  it("cascades delete when user is deleted", async () => {
    await db.insert(users).values({
      id: "test-user-prefs-3",
      email: "prefs3@test.com",
      name: "Test User 3",
    });

    await db.insert(userPreferences).values({ userId: "test-user-prefs-3" });
    await db.delete(users).where(eq(users.id, "test-user-prefs-3"));

    const remaining = await db
      .select()
      .from(userPreferences)
      .where(eq(userPreferences.userId, "test-user-prefs-3"));

    expect(remaining).toHaveLength(0);
  });

  it("updates preferences", async () => {
    await db.insert(users).values({
      id: "test-user-prefs-4",
      email: "prefs4@test.com",
      name: "Test User 4",
    });

    await db.insert(userPreferences).values({ userId: "test-user-prefs-4" });

    const [updated] = await db
      .update(userPreferences)
      .set({ locale: "el", density: "compact" })
      .where(eq(userPreferences.userId, "test-user-prefs-4"))
      .returning();

    expect(updated.locale).toBe("el");
    expect(updated.density).toBe("compact");
  });
});
