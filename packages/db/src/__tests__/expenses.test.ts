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
  RECURRING_EXPENSE_STATUS,
} from "../schema/index";
import { eq } from "drizzle-orm";

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
      id: "user-1",
      email: "test@example.com",
      name: "Test User",
    });

    const [org] = await db
      .insert(organisations)
      .values({ name: "Test Org", slug: "test-org-exp" })
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
      })
      .returning();
    contactId = contact.id;

    const [cat] = await db
      .insert(expenseCategories)
      .values({
        orgId,
        groupCode: "rent",
        code: "office_rent_exp",
        name: "Office Rent",
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
        expenseDate: "2026-04-13",
        currencyCode: "EUR",
        contactName: "Supplier Co",
      })
      .returning();

    expect(expense.status).toBe(EXPENSE_STATUS.DRAFT);
    expect(expense.expenseNumber).toBe("EXP-0001");
    expect(expense.subtotal).toBe("0.00");
    expect(expense.source).toBe("manual");
  });

  it("creates expense with line items", async () => {
    const [expense] = await db
      .insert(expenses)
      .values({
        orgId,
        expenseNumber: "EXP-0002",
        expenseDate: "2026-04-13",
        subtotal: "100.00",
        taxAmount: "24.00",
        total: "124.00",
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
        taxRate: "24.00",
        taxAmount: "24.00",
        lineTotal: "124.00",
      })
      .returning();

    expect(item.expenseId).toBe(expense.id);
    expect(item.name).toBe("Office Supplies");
    expect(item.quantity).toBe("5.0000");
  });

  it("cascades delete of line items when expense deleted", async () => {
    const [expense] = await db
      .insert(expenses)
      .values({
        orgId,
        expenseNumber: "EXP-0003",
        expenseDate: "2026-04-13",
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

  it("creates expense attachment", async () => {
    const [expense] = await db
      .insert(expenses)
      .values({
        orgId,
        expenseNumber: "EXP-0004",
        expenseDate: "2026-04-13",
      })
      .returning();

    const [attachment] = await db
      .insert(expenseAttachments)
      .values({
        expenseId: expense.id,
        filePath: "uploads/test/receipt.pdf",
        fileName: "receipt.pdf",
        mimeType: "application/pdf",
        fileSize: 12345,
        fileHash: "abc123def456",
        aiStatus: "pending",
      })
      .returning();

    expect(attachment.expenseId).toBe(expense.id);
    expect(attachment.aiStatus).toBe("pending");
    expect(attachment.fileName).toBe("receipt.pdf");
  });

  it("cascades delete attachments when expense deleted", async () => {
    const [expense] = await db
      .insert(expenses)
      .values({
        orgId,
        expenseNumber: "EXP-0005",
        expenseDate: "2026-04-13",
      })
      .returning();

    await db.insert(expenseAttachments).values({
      expenseId: expense.id,
      filePath: "uploads/test/receipt2.pdf",
      fileName: "receipt2.pdf",
      mimeType: "application/pdf",
      fileSize: 5000,
      fileHash: "hash123",
    });

    await db.delete(expenses).where(eq(expenses.id, expense.id));

    const remaining = await db
      .select()
      .from(expenseAttachments)
      .where(eq(expenseAttachments.expenseId, expense.id));

    expect(remaining.length).toBe(0);
  });

  it("tracks status transitions", async () => {
    const [expense] = await db
      .insert(expenses)
      .values({
        orgId,
        expenseNumber: "EXP-0006",
        expenseDate: "2026-04-13",
      })
      .returning();

    expect(expense.status).toBe(EXPENSE_STATUS.DRAFT);

    const [confirmed] = await db
      .update(expenses)
      .set({ status: EXPENSE_STATUS.CONFIRMED })
      .where(eq(expenses.id, expense.id))
      .returning();

    expect(confirmed.status).toBe(EXPENSE_STATUS.CONFIRMED);

    const [cancelled] = await db
      .update(expenses)
      .set({ status: EXPENSE_STATUS.CANCELLED })
      .where(eq(expenses.id, expense.id))
      .returning();

    expect(cancelled.status).toBe(EXPENSE_STATUS.CANCELLED);
  });

  it("cascades delete when org is deleted", async () => {
    const [tempOrg] = await db
      .insert(organisations)
      .values({ name: "Temp Org", slug: "temp-org-exp" })
      .returning();

    await db.insert(expenses).values({
      orgId: tempOrg.id,
      expenseNumber: "EXP-TEMP",
      expenseDate: "2026-04-13",
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
      id: "user-2",
      email: "test2@example.com",
      name: "Test User 2",
    });

    const [org] = await db
      .insert(organisations)
      .values({ name: "Test Org 2", slug: "test-org-rexp" })
      .returning();
    orgId = org.id;
  });

  afterAll(async () => {
    await teardown();
  });

  it("creates a recurring expense", async () => {
    const [rec] = await db
      .insert(recurringExpenses)
      .values({
        orgId,
        startDate: "2026-05-01",
        nextRunDate: "2026-05-01",
        description: "Monthly rent",
      })
      .returning();

    expect(rec.status).toBe(RECURRING_EXPENSE_STATUS.ACTIVE);
    expect(rec.frequency).toBe(4); // MONTHLY
    expect(rec.autoConfirm).toBe(false);
  });

  it("creates recurring expense with items", async () => {
    const [rec] = await db
      .insert(recurringExpenses)
      .values({
        orgId,
        startDate: "2026-05-01",
        nextRunDate: "2026-05-01",
      })
      .returning();

    const [item] = await db
      .insert(recurringExpenseItems)
      .values({
        recurringExpenseId: rec.id,
        sortOrder: 0,
        name: "Office Rent",
        quantity: "1",
        unitPrice: "500.00",
        taxRate: "24.00",
        taxAmount: "120.00",
        lineTotal: "620.00",
      })
      .returning();

    expect(item.recurringExpenseId).toBe(rec.id);
    expect(item.name).toBe("Office Rent");
  });

  it("cascades delete items when recurring expense deleted", async () => {
    const [rec] = await db
      .insert(recurringExpenses)
      .values({
        orgId,
        startDate: "2026-06-01",
        nextRunDate: "2026-06-01",
      })
      .returning();

    await db.insert(recurringExpenseItems).values({
      recurringExpenseId: rec.id,
      sortOrder: 0,
      name: "Item to delete",
      quantity: "1",
      unitPrice: "100.00",
      taxRate: "0.00",
      taxAmount: "0.00",
      lineTotal: "100.00",
    });

    await db.delete(recurringExpenses).where(eq(recurringExpenses.id, rec.id));

    const remaining = await db
      .select()
      .from(recurringExpenseItems)
      .where(eq(recurringExpenseItems.recurringExpenseId, rec.id));

    expect(remaining.length).toBe(0);
  });
});
