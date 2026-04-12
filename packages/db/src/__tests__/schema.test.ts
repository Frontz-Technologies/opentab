import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createTestDb, type TestDatabase } from "../test-utils.js";
import { users, organisations, orgMemberships } from "../schema/index.js";

describe("Database Schema", () => {
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

  describe("User", () => {
    it("creates a user with required fields", async () => {
      const [user] = await db
        .insert(users)
        .values({ id: "user-1", email: "test@example.com", name: "Test User" })
        .returning();

      expect(user.id).toBe("user-1");
      expect(user.email).toBe("test@example.com");
      expect(user.name).toBe("Test User");
      expect(user.locale).toBe("en");
      expect(user.timezone).toBe("UTC");
      expect(user.emailVerified).toBe(false);
      expect(user.image).toBeNull();
    });

    it("enforces unique email", async () => {
      await db
        .insert(users)
        .values({ id: "user-2", email: "unique@example.com", name: "User 1" });
      await expect(
        db.insert(users).values({
          id: "user-3",
          email: "unique@example.com",
          name: "User 2",
        }),
      ).rejects.toThrow();
    });
  });

  describe("Organisation", () => {
    it("creates an organisation with defaults", async () => {
      const [org] = await db
        .insert(organisations)
        .values({ name: "Test Company", slug: "test-company" })
        .returning();

      expect(org.id).toBeDefined();
      expect(org.name).toBe("Test Company");
      expect(org.slug).toBe("test-company");
      expect(org.defaultCurrency).toBe("EUR");
      expect(org.fiscalYearStart).toBe(1);
      expect(org.setupCompletedSteps).toEqual([]);
    });

    it("enforces unique slug", async () => {
      await db
        .insert(organisations)
        .values({ name: "Org A", slug: "unique-slug" });
      await expect(
        db.insert(organisations).values({ name: "Org B", slug: "unique-slug" }),
      ).rejects.toThrow();
    });
  });

  describe("OrgMembership", () => {
    it("creates membership linking user to org", async () => {
      const [user] = await db
        .insert(users)
        .values({ id: "member-1", email: "member@example.com", name: "Member" })
        .returning();
      const [org] = await db
        .insert(organisations)
        .values({ name: "Member Org", slug: "member-org" })
        .returning();

      const [membership] = await db
        .insert(orgMemberships)
        .values({ userId: user.id, orgId: org.id, role: "owner" })
        .returning();

      expect(membership.userId).toBe(user.id);
      expect(membership.orgId).toBe(org.id);
      expect(membership.role).toBe("owner");
    });

    it("enforces one org per user", async () => {
      const [user] = await db
        .insert(users)
        .values({
          id: "oneorg-1",
          email: "oneorg@example.com",
          name: "One Org",
        })
        .returning();
      const [org1] = await db
        .insert(organisations)
        .values({ name: "Org 1", slug: "org-one" })
        .returning();
      const [org2] = await db
        .insert(organisations)
        .values({ name: "Org 2", slug: "org-two" })
        .returning();

      await db
        .insert(orgMemberships)
        .values({ userId: user.id, orgId: org1.id, role: "owner" });
      await expect(
        db
          .insert(orgMemberships)
          .values({ userId: user.id, orgId: org2.id, role: "member" }),
      ).rejects.toThrow();
    });
  });
});
