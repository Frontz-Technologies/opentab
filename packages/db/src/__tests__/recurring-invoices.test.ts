import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createTestDb, type TestDatabase } from "../test-utils";
import {
  recurringInvoices,
  recurringInvoiceItems,
  contacts,
  organisations,
  users,
  RECURRING_STATUS,
  FREQUENCY,
} from "../schema/index";
import { eq } from "drizzle-orm";

describe("recurring invoices schema", () => {
  let db: TestDatabase;
  let teardown: () => Promise<void>;
  let orgId: string;
  let contactId: string;

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

    const [contact] = await db
      .insert(contacts)
      .values({
        orgId,
        type: "client",
        classification: "business",
        displayName: "Monthly Client",
      })
      .returning();
    contactId = contact.id;
  });

  afterAll(async () => {
    await teardown();
  });

  it("creates a recurring invoice", async () => {
    const [recurring] = await db
      .insert(recurringInvoices)
      .values({
        orgId,
        contactId,
        frequency: FREQUENCY.MONTHLY,
        startDate: "2026-05-01",
        nextSendDate: "2026-05-01",
        currencyCode: "EUR",
      })
      .returning();

    expect(recurring.status).toBe(RECURRING_STATUS.ACTIVE);
    expect(recurring.frequency).toBe(FREQUENCY.MONTHLY);
    expect(recurring.autoSend).toBe(false);
  });

  it("creates recurring invoice with line items", async () => {
    const [recurring] = await db
      .insert(recurringInvoices)
      .values({
        orgId,
        contactId,
        frequency: FREQUENCY.QUARTERLY,
        startDate: "2026-04-01",
        nextSendDate: "2026-07-01",
        currencyCode: "EUR",
      })
      .returning();

    const [item] = await db
      .insert(recurringInvoiceItems)
      .values({
        recurringInvoiceId: recurring.id,
        sortOrder: 0,
        name: "Monthly Retainer",
        quantity: "1",
        unitPrice: "500.00",
        taxCategory: "standard",
        taxRate: "24.00",
        taxAmount: "120.00",
        lineTotal: "620.00",
      })
      .returning();

    expect(item.recurringInvoiceId).toBe(recurring.id);
    expect(item.name).toBe("Monthly Retainer");
  });

  it("cascades delete of items when recurring invoice deleted", async () => {
    const [recurring] = await db
      .insert(recurringInvoices)
      .values({
        orgId,
        contactId,
        frequency: FREQUENCY.MONTHLY,
        startDate: "2026-06-01",
        nextSendDate: "2026-06-01",
        currencyCode: "EUR",
      })
      .returning();

    await db.insert(recurringInvoiceItems).values({
      recurringInvoiceId: recurring.id,
      sortOrder: 0,
      name: "Delete me",
      quantity: "1",
      unitPrice: "100.00",
      taxCategory: "standard",
      taxRate: "0.00",
      taxAmount: "0.00",
      lineTotal: "100.00",
    });

    await db
      .delete(recurringInvoices)
      .where(eq(recurringInvoices.id, recurring.id));

    const remaining = await db
      .select()
      .from(recurringInvoiceItems)
      .where(eq(recurringInvoiceItems.recurringInvoiceId, recurring.id));

    expect(remaining.length).toBe(0);
  });

  it("tracks status transitions", async () => {
    const [recurring] = await db
      .insert(recurringInvoices)
      .values({
        orgId,
        contactId,
        frequency: FREQUENCY.MONTHLY,
        startDate: "2026-01-01",
        nextSendDate: "2026-01-01",
        currencyCode: "EUR",
      })
      .returning();

    expect(recurring.status).toBe(RECURRING_STATUS.ACTIVE);

    const [paused] = await db
      .update(recurringInvoices)
      .set({ status: RECURRING_STATUS.PAUSED })
      .where(eq(recurringInvoices.id, recurring.id))
      .returning();

    expect(paused.status).toBe(RECURRING_STATUS.PAUSED);
  });
});
