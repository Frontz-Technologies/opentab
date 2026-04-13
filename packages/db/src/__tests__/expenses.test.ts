import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createTestDb, type TestDatabase } from "../test-utils";
import {
  expenses,
  expenseItems,
  expenseAttachments,
  expenseCategories,
  recurringExpenses,
  recurringExpenseItems,
  contacts,
  organisations,
  users,
  EXPENSE_STATUS,
  EXPENSE_SOURCE,
  RECURRING_EXPENSE_STATUS,
  EXPENSE_FREQUENCY,
  AI_STATUS,
} from "../schema/index";
import { eq } from "drizzle-orm";

describe("expense categories schema", () => {
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

  it("creates a system category (org_id = null)", async () => {
    const [cat] = await db
      .insert(expenseCategories)
      .values({
        orgId: null,
        code: "operating",
        nameEn: "Operating Expenses",
        nameEs: "Gastos Operativos",
        nameEl: "Λειτουργικά Έξοδα",
        color: "#4EDEA3",
        icon: "business_center",
        depth: 0,
      })
      .returning();

    expect(cat.orgId).toBeNull();
    expect(cat.code).toBe("operating");
    expect(cat.nameEn).toBe("Operating Expenses");
    expect(cat.depth).toBe(0);
    expect(cat.active).toBe(true);
  });

  it("creates child categories with parent_id", async () => {
    const [parent] = await db
      .insert(expenseCategories)
      .values({
        orgId: null,
        code: "technology",
        nameEn: "Technology",
        depth: 0,
      })
      .returning();

    const [child] = await db
      .insert(expenseCategories)
      .values({
        orgId: null,
        parentId: parent.id,
        code: "technology.software",
        nameEn: "Software Subscriptions",
        depth: 1,
      })
      .returning();

    expect(child.parentId).toBe(parent.id);
    expect(child.depth).toBe(1);

    const [grandchild] = await db
      .insert(expenseCategories)
      .values({
        orgId: null,
        parentId: child.id,
        code: "technology.software.saas",
        nameEn: "SaaS",
        depth: 2,
      })
      .returning();

    expect(grandchild.depth).toBe(2);
  });

  it("creates custom category with org_id", async () => {
    const [cat] = await db
      .insert(expenseCategories)
      .values({
        orgId,
        code: "custom.category",
        nameEn: "My Custom Category",
        color: "#FF0000",
        depth: 0,
      })
      .returning();

    expect(cat.orgId).toBe(orgId);
    expect(cat.code).toBe("custom.category");
  });

  it("cascades delete when org is deleted", async () => {
    const [tempOrg] = await db
      .insert(organisations)
      .values({ name: "Temp Org Cat", slug: "temp-org-cat" })
      .returning();

    await db.insert(expenseCategories).values({
      orgId: tempOrg.id,
      code: "temp.cat",
      nameEn: "Temp Category",
      depth: 0,
    });

    await db.delete(organisations).where(eq(organisations.id, tempOrg.id));

    const remaining = await db
      .select()
      .from(expenseCategories)
      .where(eq(expenseCategories.orgId, tempOrg.id));

    expect(remaining.length).toBe(0);
  });
});

describe("expenses schema", () => {
  let db: TestDatabase;
  let teardown: () => Promise<void>;
  let orgId: string;
  let contactId: string;
  let categoryId: string;

  beforeAll(async () => {
    const result = await createTestDb();
    db = result.db;
    teardown = result.teardown;

    await db.insert(users).values({
      id: "user-2",
      email: "test2@example.com",
      name: "Test User 2",
    });

    const [org] = await db
      .insert(organisations)
      .values({ name: "Test Org 2", slug: "test-org-2" })
      .returning();
    orgId = org.id;

    const [contact] = await db
      .insert(contacts)
      .values({
        orgId,
        type: "supplier",
        classification: "business",
        company: "Supplier Co",
        displayName: "Supplier Co",
        vatNumber: "EL123456789",
      })
      .returning();
    contactId = contact.id;

    const [cat] = await db
      .insert(expenseCategories)
      .values({
        orgId: null,
        code: "operating_test",
        nameEn: "Operating Expenses",
        depth: 0,
      })
      .returning();
    categoryId = cat.id;
  });

  afterAll(async () => {
    await teardown();
  });

  it("creates a draft expense", async () => {
    const [expense] = await db
      .insert(expenses)
      .values({
        orgId,
        contactId,
        categoryId,
        expenseNumber: "EXP-0001",
        issueDate: "2026-04-12",
        contactName: "Supplier Co",
        contactVatNumber: "EL123456789",
      })
      .returning();

    expect(expense.status).toBe(EXPENSE_STATUS.DRAFT);
    expect(expense.expenseNumber).toBe("EXP-0001");
    expect(expense.source).toBe(EXPENSE_SOURCE.MANUAL);
    expect(expense.subtotal).toBe("0.00");
    expect(expense.total).toBe("0.00");
  });

  it("creates expense with line items", async () => {
    const [expense] = await db
      .insert(expenses)
      .values({
        orgId,
        contactId,
        expenseNumber: "EXP-0002",
        issueDate: "2026-04-12",
        subtotal: "100.00",
        taxAmount: "24.00",
        total: "124.00",
        contactName: "Supplier Co",
      })
      .returning();

    const [item] = await db
      .insert(expenseItems)
      .values({
        expenseId: expense.id,
        sortOrder: 0,
        name: "Office Supplies",
        quantity: "5",
        unitPrice: "20.00",
        taxCategory: "standard",
        taxRate: "24.00",
        taxAmount: "24.00",
        lineTotal: "124.00",
      })
      .returning();

    expect(item.expenseId).toBe(expense.id);
    expect(item.name).toBe("Office Supplies");
    expect(item.quantity).toBe("5.0000");
    expect(item.taxRate).toBe("24.00");
  });

  it("tracks status transitions", async () => {
    const [expense] = await db
      .insert(expenses)
      .values({
        orgId,
        expenseNumber: "EXP-0003",
        issueDate: "2026-04-12",
      })
      .returning();

    expect(expense.status).toBe(EXPENSE_STATUS.DRAFT);

    const [confirmed] = await db
      .update(expenses)
      .set({ status: EXPENSE_STATUS.CONFIRMED, updatedAt: new Date() })
      .where(eq(expenses.id, expense.id))
      .returning();

    expect(confirmed.status).toBe(EXPENSE_STATUS.CONFIRMED);

    const [cancelled] = await db
      .update(expenses)
      .set({ status: EXPENSE_STATUS.CANCELLED, updatedAt: new Date() })
      .where(eq(expenses.id, expense.id))
      .returning();

    expect(cancelled.status).toBe(EXPENSE_STATUS.CANCELLED);
  });

  it("cascades delete of line items when expense deleted", async () => {
    const [expense] = await db
      .insert(expenses)
      .values({
        orgId,
        expenseNumber: "EXP-0004",
        issueDate: "2026-04-12",
      })
      .returning();

    await db.insert(expenseItems).values({
      expenseId: expense.id,
      sortOrder: 0,
      name: "Item to delete",
      quantity: "1",
      unitPrice: "50.00",
      taxRate: "24.00",
      taxAmount: "12.00",
      lineTotal: "62.00",
    });

    await db.delete(expenses).where(eq(expenses.id, expense.id));

    const remaining = await db
      .select()
      .from(expenseItems)
      .where(eq(expenseItems.expenseId, expense.id));

    expect(remaining.length).toBe(0);
  });

  it("creates expense attachment with AI fields", async () => {
    const [expense] = await db
      .insert(expenses)
      .values({
        orgId,
        expenseNumber: "EXP-0005",
        issueDate: "2026-04-12",
        source: EXPENSE_SOURCE.AI_EXTRACT,
      })
      .returning();

    const [attachment] = await db
      .insert(expenseAttachments)
      .values({
        expenseId: expense.id,
        filePath: "uploads/test/expenses/abc123.pdf",
        fileName: "receipt.pdf",
        fileSize: 1024,
        mimeType: "application/pdf",
        fileHash: "a".repeat(64),
        aiStatus: AI_STATUS.PENDING,
      })
      .returning();

    expect(attachment.aiStatus).toBe(AI_STATUS.PENDING);
    expect(attachment.fileHash).toBe("a".repeat(64));
    expect(attachment.extractedData).toBeNull();

    // Update after AI processing
    const extractedData = {
      supplier: {
        name: "Supplier Co",
        vatNumber: "EL123456789",
        confidence: 0.95,
      },
      total: { value: 124, confidence: 0.9 },
    };

    const [processed] = await db
      .update(expenseAttachments)
      .set({
        aiStatus: AI_STATUS.COMPLETED,
        extractedData,
        aiConfidence: "0.92",
        aiProcessedAt: new Date(),
      })
      .where(eq(expenseAttachments.id, attachment.id))
      .returning();

    expect(processed.aiStatus).toBe(AI_STATUS.COMPLETED);
    expect(processed.aiConfidence).toBe("0.92");
    expect(processed.extractedData).toEqual(extractedData);
  });

  it("cascades delete of attachments when expense deleted", async () => {
    const [expense] = await db
      .insert(expenses)
      .values({
        orgId,
        expenseNumber: "EXP-0006",
        issueDate: "2026-04-12",
      })
      .returning();

    await db.insert(expenseAttachments).values({
      expenseId: expense.id,
      filePath: "uploads/test/expenses/del.pdf",
      fileName: "delete-me.pdf",
      fileSize: 512,
      mimeType: "application/pdf",
      fileHash: "b".repeat(64),
    });

    await db.delete(expenses).where(eq(expenses.id, expense.id));

    const remaining = await db
      .select()
      .from(expenseAttachments)
      .where(eq(expenseAttachments.expenseId, expense.id));

    expect(remaining.length).toBe(0);
  });

  it("cascades delete when org is deleted", async () => {
    const [tempOrg] = await db
      .insert(organisations)
      .values({ name: "Temp Org Exp", slug: "temp-org-exp" })
      .returning();

    await db.insert(expenses).values({
      orgId: tempOrg.id,
      expenseNumber: "EXP-TEMP",
      issueDate: "2026-04-12",
    });

    await db.delete(organisations).where(eq(organisations.id, tempOrg.id));

    const remaining = await db
      .select()
      .from(expenses)
      .where(eq(expenses.orgId, tempOrg.id));

    expect(remaining.length).toBe(0);
  });
});

describe("recurring expenses schema", () => {
  let db: TestDatabase;
  let teardown: () => Promise<void>;
  let orgId: string;

  beforeAll(async () => {
    const result = await createTestDb();
    db = result.db;
    teardown = result.teardown;

    await db.insert(users).values({
      id: "user-3",
      email: "test3@example.com",
      name: "Test User 3",
    });

    const [org] = await db
      .insert(organisations)
      .values({ name: "Test Org 3", slug: "test-org-3" })
      .returning();
    orgId = org.id;
  });

  afterAll(async () => {
    await teardown();
  });

  it("creates a recurring expense", async () => {
    const [recurring] = await db
      .insert(recurringExpenses)
      .values({
        orgId,
        frequency: EXPENSE_FREQUENCY.MONTHLY,
        startDate: "2026-04-01",
        nextRunDate: "2026-05-01",
        description: "Monthly hosting",
      })
      .returning();

    expect(recurring.status).toBe(RECURRING_EXPENSE_STATUS.ACTIVE);
    expect(recurring.frequency).toBe(EXPENSE_FREQUENCY.MONTHLY);
    expect(recurring.autoConfirm).toBe(false);
  });

  it("creates recurring expense with line items", async () => {
    const [recurring] = await db
      .insert(recurringExpenses)
      .values({
        orgId,
        frequency: EXPENSE_FREQUENCY.QUARTERLY,
        startDate: "2026-01-01",
        nextRunDate: "2026-04-01",
      })
      .returning();

    const [item] = await db
      .insert(recurringExpenseItems)
      .values({
        recurringExpenseId: recurring.id,
        sortOrder: 0,
        name: "Cloud hosting",
        quantity: "1",
        unitPrice: "29.99",
        taxRate: "24.00",
        taxAmount: "7.20",
        lineTotal: "37.19",
      })
      .returning();

    expect(item.recurringExpenseId).toBe(recurring.id);
    expect(item.name).toBe("Cloud hosting");
  });

  it("tracks status transitions", async () => {
    const [recurring] = await db
      .insert(recurringExpenses)
      .values({
        orgId,
        frequency: EXPENSE_FREQUENCY.MONTHLY,
        startDate: "2026-04-01",
        nextRunDate: "2026-05-01",
      })
      .returning();

    expect(recurring.status).toBe(RECURRING_EXPENSE_STATUS.ACTIVE);

    const [paused] = await db
      .update(recurringExpenses)
      .set({ status: RECURRING_EXPENSE_STATUS.PAUSED })
      .where(eq(recurringExpenses.id, recurring.id))
      .returning();

    expect(paused.status).toBe(RECURRING_EXPENSE_STATUS.PAUSED);
  });

  it("cascades delete of line items when recurring expense deleted", async () => {
    const [recurring] = await db
      .insert(recurringExpenses)
      .values({
        orgId,
        frequency: EXPENSE_FREQUENCY.MONTHLY,
        startDate: "2026-04-01",
        nextRunDate: "2026-05-01",
      })
      .returning();

    await db.insert(recurringExpenseItems).values({
      recurringExpenseId: recurring.id,
      sortOrder: 0,
      name: "Item to cascade",
      quantity: "1",
      unitPrice: "10.00",
      taxRate: "0.00",
      taxAmount: "0.00",
      lineTotal: "10.00",
    });

    await db
      .delete(recurringExpenses)
      .where(eq(recurringExpenses.id, recurring.id));

    const remaining = await db
      .select()
      .from(recurringExpenseItems)
      .where(eq(recurringExpenseItems.recurringExpenseId, recurring.id));

    expect(remaining.length).toBe(0);
  });
});
