import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createTestDb } from "@opentab/db/test-utils";
import {
  organisations,
  contacts,
  expenseCategories,
  expenseGroups,
  invoices,
  products,
} from "@opentab/db/schema";
import {
  assertContactInOrg,
  assertExpenseCategoryInOrg,
  assertInvoiceInOrg,
  assertProductsInOrg,
  CROSS_ORG_ACCESS_ERROR,
} from "@/lib/security/assert-same-org";

// Write-side FK same-org validation. The helpers throw
// `Error("cross-org-access")` when the requested id does not belong
// to the supplied orgId. These tests freeze the contract for each of
// the four wrappers (single-row + batch product variant).

describe("assert-same-org helpers (#274)", () => {
  let db: Awaited<ReturnType<typeof createTestDb>>["db"];
  let teardown: () => Promise<void>;
  let orgAId: string;
  let orgBId: string;
  let contactAId: string;
  let contactBId: string;
  let categoryAId: string;
  let categoryBId: string;
  let invoiceAId: string;
  let invoiceBId: string;
  let productAId: string;
  let productA2Id: string;
  let productBId: string;

  beforeAll(async () => {
    const ctx = await createTestDb();
    db = ctx.db;
    teardown = ctx.teardown;

    const [a] = await db
      .insert(organisations)
      .values({ name: "Org A", slug: "org-a-helper-274", countryCode: "GR" })
      .returning();
    const [b] = await db
      .insert(organisations)
      .values({ name: "Org B", slug: "org-b-helper-274", countryCode: "GR" })
      .returning();
    orgAId = a.id;
    orgBId = b.id;

    const [contactA] = await db
      .insert(contacts)
      .values({ orgId: orgAId, displayName: "A Contact" })
      .returning();
    const [contactB] = await db
      .insert(contacts)
      .values({ orgId: orgBId, displayName: "B Contact" })
      .returning();
    contactAId = contactA.id;
    contactBId = contactB.id;

    // Expense categories require a parent expense_group. Seed one.
    await db
      .insert(expenseGroups)
      .values({ code: "other", nameEn: "Other" })
      .onConflictDoNothing();
    const [catA] = await db
      .insert(expenseCategories)
      .values({
        orgId: orgAId,
        groupCode: "other",
        code: "A-1",
        name: "Cat A",
      })
      .returning();
    const [catB] = await db
      .insert(expenseCategories)
      .values({
        orgId: orgBId,
        groupCode: "other",
        code: "B-1",
        name: "Cat B",
      })
      .returning();
    categoryAId = catA.id;
    categoryBId = catB.id;

    const [invA] = await db
      .insert(invoices)
      .values({
        orgId: orgAId,
        contactId: contactAId,
        issueDate: "2026-04-01",
        contactName: "A",
      })
      .returning();
    const [invB] = await db
      .insert(invoices)
      .values({
        orgId: orgBId,
        contactId: contactBId,
        issueDate: "2026-04-01",
        contactName: "B",
      })
      .returning();
    invoiceAId = invA.id;
    invoiceBId = invB.id;

    const [pA] = await db
      .insert(products)
      .values({ orgId: orgAId, name: "Product A" })
      .returning();
    const [pA2] = await db
      .insert(products)
      .values({ orgId: orgAId, name: "Product A2" })
      .returning();
    const [pB] = await db
      .insert(products)
      .values({ orgId: orgBId, name: "Product B" })
      .returning();
    productAId = pA.id;
    productA2Id = pA2.id;
    productBId = pB.id;
  });

  afterAll(async () => {
    await teardown();
  });

  describe("assertContactInOrg", () => {
    it("resolves when the contact belongs to the org", async () => {
      await expect(
        assertContactInOrg(db, contactAId, orgAId),
      ).resolves.toBeUndefined();
    });

    it("throws cross-org-access when the contact belongs to another org", async () => {
      await expect(assertContactInOrg(db, contactBId, orgAId)).rejects.toThrow(
        CROSS_ORG_ACCESS_ERROR,
      );
    });
  });

  describe("assertExpenseCategoryInOrg", () => {
    it("resolves when the category belongs to the org", async () => {
      await expect(
        assertExpenseCategoryInOrg(db, categoryAId, orgAId),
      ).resolves.toBeUndefined();
    });

    it("throws cross-org-access when the category belongs to another org", async () => {
      await expect(
        assertExpenseCategoryInOrg(db, categoryBId, orgAId),
      ).rejects.toThrow(CROSS_ORG_ACCESS_ERROR);
    });
  });

  describe("assertInvoiceInOrg", () => {
    it("resolves when the invoice belongs to the org", async () => {
      await expect(
        assertInvoiceInOrg(db, invoiceAId, orgAId),
      ).resolves.toBeUndefined();
    });

    it("throws cross-org-access when the invoice belongs to another org", async () => {
      await expect(assertInvoiceInOrg(db, invoiceBId, orgAId)).rejects.toThrow(
        CROSS_ORG_ACCESS_ERROR,
      );
    });
  });

  describe("assertProductsInOrg (batch)", () => {
    it("is a no-op for an empty id list", async () => {
      await expect(
        assertProductsInOrg(db, [], orgAId),
      ).resolves.toBeUndefined();
    });

    it("resolves when every id belongs to the org", async () => {
      await expect(
        assertProductsInOrg(db, [productAId, productA2Id], orgAId),
      ).resolves.toBeUndefined();
    });

    it("throws when any id belongs to another org (batch with one bad id)", async () => {
      await expect(
        assertProductsInOrg(db, [productAId, productBId], orgAId),
      ).rejects.toThrow(CROSS_ORG_ACCESS_ERROR);
    });

    it("throws when a non-existent id is mixed in", async () => {
      const fakeId = "00000000-0000-0000-0000-000000000000";
      await expect(
        assertProductsInOrg(db, [productAId, fakeId], orgAId),
      ).rejects.toThrow(CROSS_ORG_ACCESS_ERROR);
    });
  });
});
