import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { createTestDb } from "@opentab/db/test-utils";
import {
  organisations,
  contacts,
  invoices,
  invoiceItems,
  creditNotes,
  expenses,
  expenseItems,
  expenseCategories,
} from "@opentab/db/schema";
import {
  getRevenue,
  getRevenueByClient,
  getRevenueByPeriod,
  getExpenseTotal,
  getExpensesByCategory,
  getOutstanding,
  getOutputVat,
  getInputVat,
  getExpensesByPeriod,
} from "@/lib/reports/queries";

// Multi-currency aggregation: every monetary column in a report query
// must be multiplied by the row's snapshotted exchange_rate so totals
// are denominated in the org's base currency. EUR rows (rate=1) act as
// identity, so existing single-currency assertions still hold.

const ORG_ID = "11111111-1111-1111-1111-111111111111";
const CONTACT_ID = "22222222-2222-2222-2222-222222222222";
const CATEGORY_ID = "33333333-3333-3333-3333-333333333333";

describe("reports/queries — exchange_rate conversion", () => {
  let db: Awaited<ReturnType<typeof createTestDb>>["db"];
  let teardown: () => Promise<void>;

  beforeAll(async () => {
    const ctx = await createTestDb();
    db = ctx.db;
    teardown = ctx.teardown;

    await db.insert(organisations).values({
      id: ORG_ID,
      name: "Acme",
      slug: "acme",
      defaultCurrency: "EUR",
    });
    await db.insert(contacts).values({
      id: CONTACT_ID,
      orgId: ORG_ID,
      type: "client",
      classification: "business",
      displayName: "Foreign Customer",
    });
    await db.insert(expenseCategories).values({
      id: CATEGORY_ID,
      orgId: ORG_ID,
      groupCode: "software",
      code: "saas",
      name: "SaaS",
    });
  });

  afterAll(async () => {
    await teardown();
  });

  beforeEach(async () => {
    // Wipe per-period data so each test sees a clean slate.
    await db.delete(invoiceItems);
    await db.delete(expenseItems);
    await db.delete(invoices);
    await db.delete(creditNotes);
    await db.delete(expenses);
  });

  it("getRevenue: sums invoices in base currency using exchange_rate", async () => {
    await db.insert(invoices).values([
      {
        orgId: ORG_ID,
        contactId: CONTACT_ID,
        contactName: "Foreign Customer",
        invoiceNumber: "INV-001",
        issueDate: "2026-04-15",
        status: 4, // PAID
        currencyCode: "EUR",
        exchangeRate: "1.000000",
        total: "100.00",
        balance: "0.00",
      },
      {
        orgId: ORG_ID,
        contactId: CONTACT_ID,
        contactName: "Foreign Customer",
        invoiceNumber: "INV-002",
        issueDate: "2026-04-16",
        status: 2, // SENT
        currencyCode: "USD",
        exchangeRate: "0.920000",
        total: "100.00", // USD
        balance: "100.00",
      },
    ]);

    const result = await getRevenue(
      ORG_ID,
      new Date("2026-04-01"),
      new Date("2026-04-30"),
      db,
    );

    // EUR 100 * 1 + USD 100 * 0.92 = 192 EUR
    expect(result.total).toBeCloseTo(192, 2);
    expect(result.count).toBe(2);
  });

  it("getRevenue: subtracts credit notes converted to base currency", async () => {
    await db.insert(invoices).values({
      orgId: ORG_ID,
      contactId: CONTACT_ID,
      contactName: "Foreign Customer",
      invoiceNumber: "INV-100",
      issueDate: "2026-04-10",
      status: 4,
      currencyCode: "EUR",
      exchangeRate: "1.000000",
      total: "500.00",
      balance: "0.00",
    });
    await db.insert(creditNotes).values({
      orgId: ORG_ID,
      contactId: CONTACT_ID,
      contactName: "Foreign Customer",
      creditNoteNumber: "CN-001",
      issueDate: "2026-04-12",
      status: 2,
      currencyCode: "USD",
      exchangeRate: "0.920000",
      total: "100.00", // USD 100 * 0.92 = 92 EUR
      reason: "refund",
    });

    const result = await getRevenue(
      ORG_ID,
      new Date("2026-04-01"),
      new Date("2026-04-30"),
      db,
    );

    // 500 - (100 * 0.92) = 408
    expect(result.total).toBeCloseTo(408, 2);
    expect(result.count).toBe(1);
  });

  it("getRevenueByClient: ranks foreign-currency totals after conversion", async () => {
    await db.insert(invoices).values({
      orgId: ORG_ID,
      contactId: CONTACT_ID,
      contactName: "Foreign Customer",
      invoiceNumber: "INV-200",
      issueDate: "2026-04-15",
      status: 2,
      currencyCode: "USD",
      exchangeRate: "0.500000",
      total: "1000.00", // USD 1000 * 0.5 = 500 EUR
      balance: "1000.00",
    });

    const rows = await getRevenueByClient(
      ORG_ID,
      new Date("2026-04-01"),
      new Date("2026-04-30"),
      db,
    );
    expect(rows.length).toBe(1);
    expect(rows[0].total).toBeCloseTo(500, 2);
  });

  it("getRevenueByPeriod: bucket totals are converted to base", async () => {
    await db.insert(invoices).values([
      {
        orgId: ORG_ID,
        contactId: CONTACT_ID,
        contactName: "Foreign Customer",
        invoiceNumber: "INV-300",
        issueDate: "2026-04-10",
        status: 4,
        currencyCode: "EUR",
        exchangeRate: "1.000000",
        total: "100.00",
        balance: "0.00",
      },
      {
        orgId: ORG_ID,
        contactId: CONTACT_ID,
        contactName: "Foreign Customer",
        invoiceNumber: "INV-301",
        issueDate: "2026-04-10",
        status: 4,
        currencyCode: "USD",
        exchangeRate: "0.500000",
        total: "200.00", // 200 * 0.5 = 100 EUR
        balance: "0.00",
      },
    ]);

    const rows = await getRevenueByPeriod(
      ORG_ID,
      new Date("2026-04-01"),
      new Date("2026-04-30"),
      "month",
      db,
    );
    expect(rows.length).toBe(1);
    expect(rows[0].total).toBeCloseTo(200, 2); // 100 + 100
  });

  it("getExpenseTotal: converts foreign-currency expenses to base", async () => {
    await db.insert(expenses).values([
      {
        orgId: ORG_ID,
        categoryId: CATEGORY_ID,
        expenseNumber: "EXP-001",
        expenseDate: "2026-04-10",
        currencyCode: "EUR",
        exchangeRate: "1.000000",
        total: "100.00",
      },
      {
        orgId: ORG_ID,
        categoryId: CATEGORY_ID,
        expenseNumber: "EXP-002",
        expenseDate: "2026-04-11",
        currencyCode: "USD",
        exchangeRate: "0.920000",
        total: "100.00", // 100 * 0.92 = 92 EUR
      },
    ]);

    const result = await getExpenseTotal(
      ORG_ID,
      new Date("2026-04-01"),
      new Date("2026-04-30"),
      db,
    );
    expect(result.total).toBeCloseTo(192, 2);
    expect(result.count).toBe(2);
  });

  it("getExpensesByCategory: per-category totals reflect conversion", async () => {
    await db.insert(expenses).values([
      {
        orgId: ORG_ID,
        categoryId: CATEGORY_ID,
        expenseNumber: "EXP-100",
        expenseDate: "2026-04-10",
        currencyCode: "USD",
        exchangeRate: "0.500000",
        total: "200.00", // 200 * 0.5 = 100 EUR
      },
    ]);

    const rows = await getExpensesByCategory(
      ORG_ID,
      new Date("2026-04-01"),
      new Date("2026-04-30"),
      db,
    );
    expect(rows.length).toBe(1);
    expect(rows[0].total).toBeCloseTo(100, 2);
  });

  it("getOutstanding: outstanding balance is converted to base", async () => {
    await db.insert(invoices).values([
      {
        orgId: ORG_ID,
        contactId: CONTACT_ID,
        contactName: "Foreign Customer",
        invoiceNumber: "INV-400",
        issueDate: "2026-04-10",
        dueDate: "2030-12-31", // future, not overdue
        status: 2,
        currencyCode: "USD",
        exchangeRate: "0.500000",
        total: "200.00",
        balance: "200.00", // 200 * 0.5 = 100 EUR outstanding
      },
    ]);

    const result = await getOutstanding(ORG_ID, db);
    expect(result.total).toBeCloseTo(100, 2);
    expect(result.count).toBe(1);
    expect(result.overdueCount).toBe(0);
  });

  it("getOutputVat: VAT lines convert taxable_base and vat_amount", async () => {
    const [inv] = await db
      .insert(invoices)
      .values({
        orgId: ORG_ID,
        contactId: CONTACT_ID,
        contactName: "Foreign Customer",
        invoiceNumber: "INV-500",
        issueDate: "2026-04-10",
        status: 2,
        currencyCode: "USD",
        exchangeRate: "0.500000",
        subtotal: "100.00",
        taxAmount: "24.00",
        total: "124.00",
        balance: "124.00",
      })
      .returning();

    await db.insert(invoiceItems).values({
      invoiceId: inv!.id,
      name: "Service",
      quantity: "1",
      unitPrice: "100.00", // base 100 USD * 0.5 = 50 EUR
      taxRate: "24.00",
      taxAmount: "24.00", // 24 USD * 0.5 = 12 EUR
      lineTotal: "124.00",
    });

    const rows = await getOutputVat(
      ORG_ID,
      new Date("2026-04-01"),
      new Date("2026-04-30"),
      db,
    );
    expect(rows.length).toBe(1);
    expect(rows[0].taxableBase).toBeCloseTo(50, 2);
    expect(rows[0].vatAmount).toBeCloseTo(12, 2);
  });

  it("getInputVat: VAT lines convert taxable_base and vat_amount", async () => {
    const [exp] = await db
      .insert(expenses)
      .values({
        orgId: ORG_ID,
        categoryId: CATEGORY_ID,
        expenseNumber: "EXP-200",
        expenseDate: "2026-04-10",
        currencyCode: "USD",
        exchangeRate: "0.500000",
        subtotal: "100.00",
        taxAmount: "24.00",
        total: "124.00",
      })
      .returning();

    await db.insert(expenseItems).values({
      expenseId: exp!.id,
      name: "Service",
      quantity: "1",
      unitPrice: "100.00",
      taxRate: "24.00",
      taxAmount: "24.00",
      lineTotal: "124.00",
    });

    const rows = await getInputVat(
      ORG_ID,
      new Date("2026-04-01"),
      new Date("2026-04-30"),
      db,
    );
    expect(rows.length).toBe(1);
    expect(rows[0].taxableBase).toBeCloseTo(50, 2);
    expect(rows[0].vatAmount).toBeCloseTo(12, 2);
  });

  it("getExpensesByPeriod: bucket totals reflect conversion", async () => {
    await db.insert(expenses).values([
      {
        orgId: ORG_ID,
        categoryId: CATEGORY_ID,
        expenseNumber: "EXP-300",
        expenseDate: "2026-04-10",
        currencyCode: "EUR",
        exchangeRate: "1.000000",
        total: "100.00",
      },
      {
        orgId: ORG_ID,
        categoryId: CATEGORY_ID,
        expenseNumber: "EXP-301",
        expenseDate: "2026-04-11",
        currencyCode: "USD",
        exchangeRate: "0.500000",
        total: "200.00", // 200 * 0.5 = 100 EUR
      },
    ]);

    const rows = await getExpensesByPeriod(
      ORG_ID,
      new Date("2026-04-01"),
      new Date("2026-04-30"),
      "month",
      db,
    );
    expect(rows.length).toBe(1);
    expect(rows[0].total).toBeCloseTo(200, 2);
  });

  it("legacy single-currency math (rate=1) still produces correct totals", async () => {
    await db.insert(invoices).values([
      {
        orgId: ORG_ID,
        contactId: CONTACT_ID,
        contactName: "Foreign Customer",
        invoiceNumber: "INV-LEGACY-1",
        issueDate: "2026-04-10",
        status: 4,
        currencyCode: "EUR",
        exchangeRate: "1.000000",
        total: "150.00",
        balance: "0.00",
      },
      {
        orgId: ORG_ID,
        contactId: CONTACT_ID,
        contactName: "Foreign Customer",
        invoiceNumber: "INV-LEGACY-2",
        issueDate: "2026-04-15",
        status: 2,
        currencyCode: "EUR",
        exchangeRate: "1.000000",
        total: "250.00",
        balance: "250.00",
      },
    ]);

    const result = await getRevenue(
      ORG_ID,
      new Date("2026-04-01"),
      new Date("2026-04-30"),
      db,
    );
    expect(result.total).toBeCloseTo(400, 2);
    expect(result.count).toBe(2);
  });
});
