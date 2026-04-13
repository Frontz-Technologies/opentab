import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createTestDb, type TestDatabase } from "../test-utils";
import {
  invoices,
  invoiceItems,
  expenses,
  expenseItems,
  contacts,
  organisations,
  users,
  expenseCategories,
  expenseGroups,
  INVOICE_STATUS,
  EXPENSE_STATUS,
} from "../schema/index";
import { sql } from "drizzle-orm";

/**
 * These tests verify the SQL aggregation patterns used by
 * apps/web/lib/reports/queries.ts, using PGlite directly.
 */
describe("report aggregation queries", () => {
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
      .values({ name: "Test Org", slug: "test-org", countryCode: "GR" })
      .returning();
    orgId = org.id;

    const [contact] = await db
      .insert(contacts)
      .values({
        orgId,
        type: "client",
        classification: "business",
        company: "Acme Corp",
        displayName: "Acme Corp",
      })
      .returning();
    contactId = contact.id;

    // Use already-seeded expense group from test-utils
    const [cat] = await db
      .insert(expenseCategories)
      .values({
        orgId,
        groupCode: "software",
        code: "saas",
        name: "SaaS Subscriptions",
      })
      .returning();
    categoryId = cat.id;
  });

  afterAll(async () => {
    await teardown();
  });

  async function createInvoice(
    overrides: {
      status?: number;
      issueDate?: string;
      total?: string;
      balance?: string;
      dueDate?: string;
      contactName?: string;
    } = {},
  ) {
    const num = `INV-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const [inv] = await db
      .insert(invoices)
      .values({
        orgId,
        contactId,
        invoiceNumber: num,
        issueDate: overrides.issueDate ?? "2026-04-01",
        contactName: overrides.contactName ?? "Acme Corp",
        status: overrides.status ?? INVOICE_STATUS.SENT,
        total: overrides.total ?? "1000.00",
        balance: overrides.balance ?? "1000.00",
        dueDate: overrides.dueDate ?? "2026-04-30",
      })
      .returning();
    return inv;
  }

  async function createExpense(
    overrides: {
      status?: number;
      expenseDate?: string;
      total?: string;
    } = {},
  ) {
    const num = `EXP-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const [exp] = await db
      .insert(expenses)
      .values({
        orgId,
        expenseNumber: num,
        expenseDate: overrides.expenseDate ?? "2026-04-01",
        status: overrides.status ?? EXPENSE_STATUS.CONFIRMED,
        total: overrides.total ?? "500.00",
        categoryId,
      })
      .returning();
    return exp;
  }

  describe("revenue queries", () => {
    it("sums only SENT/PARTIAL/PAID invoices within date range", async () => {
      // Create invoices in range with various statuses
      await createInvoice({
        status: INVOICE_STATUS.SENT,
        total: "1000.00",
        issueDate: "2026-04-10",
      });
      await createInvoice({
        status: INVOICE_STATUS.PAID,
        total: "2000.00",
        issueDate: "2026-04-15",
      });
      await createInvoice({
        status: INVOICE_STATUS.PARTIAL,
        total: "500.00",
        issueDate: "2026-04-20",
      });

      const result = await db.execute(sql`
        SELECT COALESCE(SUM(total::numeric), 0) AS total, COUNT(*)::int AS count
        FROM invoice
        WHERE org_id = ${orgId}
          AND status IN (2, 3, 4)
          AND issue_date BETWEEN '2026-04-01' AND '2026-04-30'
      `);
      const rows = (result as any).rows as Record<string, unknown>[];
      expect(Number(rows[0].total)).toBeGreaterThanOrEqual(3500);
      expect(Number(rows[0].count)).toBeGreaterThanOrEqual(3);
    });

    it("excludes DRAFT and CANCELLED invoices", async () => {
      await createInvoice({
        status: INVOICE_STATUS.DRAFT,
        total: "9999.00",
        issueDate: "2026-05-01",
      });
      await createInvoice({
        status: INVOICE_STATUS.CANCELLED,
        total: "8888.00",
        issueDate: "2026-05-01",
      });

      const result = await db.execute(sql`
        SELECT COALESCE(SUM(total::numeric), 0) AS total
        FROM invoice
        WHERE org_id = ${orgId}
          AND status IN (2, 3, 4)
          AND issue_date BETWEEN '2026-05-01' AND '2026-05-31'
      `);
      const rows = (result as any).rows as Record<string, unknown>[];
      expect(Number(rows[0].total)).toBe(0);
    });

    it("excludes invoices outside date range", async () => {
      await createInvoice({
        status: INVOICE_STATUS.SENT,
        total: "7777.00",
        issueDate: "2025-01-01",
      });

      const result = await db.execute(sql`
        SELECT COALESCE(SUM(total::numeric), 0) AS total
        FROM invoice
        WHERE org_id = ${orgId}
          AND status IN (2, 3, 4)
          AND issue_date BETWEEN '2026-06-01' AND '2026-06-30'
      `);
      const rows = (result as any).rows as Record<string, unknown>[];
      expect(Number(rows[0].total)).toBe(0);
    });

    it("groups revenue by client sorted by total descending", async () => {
      const [contact2] = await db
        .insert(contacts)
        .values({
          orgId,
          type: "client",
          classification: "business",
          displayName: "Big Spender Inc",
        })
        .returning();

      await createInvoice({
        status: INVOICE_STATUS.PAID,
        total: "5000.00",
        issueDate: "2026-07-10",
        contactName: "Big Spender Inc",
      });
      await createInvoice({
        status: INVOICE_STATUS.PAID,
        total: "100.00",
        issueDate: "2026-07-10",
        contactName: "Acme Corp",
      });

      const result = await db.execute(sql`
        SELECT contact_name AS display_name,
          COALESCE(SUM(total::numeric), 0) AS total, COUNT(*)::int AS invoice_count
        FROM invoice
        WHERE org_id = ${orgId}
          AND status IN (2, 3, 4)
          AND issue_date BETWEEN '2026-07-01' AND '2026-07-31'
        GROUP BY contact_id, contact_name
        ORDER BY SUM(total::numeric) DESC
        LIMIT 10
      `);
      const rows = (result as any).rows as Record<string, unknown>[];
      expect(rows.length).toBeGreaterThanOrEqual(1);
      // First row should be the highest total
      if (rows.length >= 2) {
        expect(Number(rows[0].total)).toBeGreaterThanOrEqual(
          Number(rows[1].total),
        );
      }
    });
  });

  describe("expense queries", () => {
    it("sums only CONFIRMED expenses within date range", async () => {
      await createExpense({
        status: EXPENSE_STATUS.CONFIRMED,
        total: "200.00",
        expenseDate: "2026-08-10",
      });
      await createExpense({
        status: EXPENSE_STATUS.DRAFT,
        total: "9999.00",
        expenseDate: "2026-08-10",
      });

      const result = await db.execute(sql`
        SELECT COALESCE(SUM(total::numeric), 0) AS total, COUNT(*)::int AS count
        FROM expense
        WHERE org_id = ${orgId}
          AND status = 2
          AND expense_date BETWEEN '2026-08-01' AND '2026-08-31'
      `);
      const rows = (result as any).rows as Record<string, unknown>[];
      expect(Number(rows[0].total)).toBe(200);
      expect(Number(rows[0].count)).toBe(1);
    });

    it("groups expenses by category with correct totals", async () => {
      await createExpense({
        total: "300.00",
        expenseDate: "2026-09-01",
      });
      await createExpense({
        total: "150.00",
        expenseDate: "2026-09-15",
      });

      const result = await db.execute(sql`
        SELECT e.category_id, COALESCE(ec.name, 'Uncategorized') AS category,
          COALESCE(SUM(e.total::numeric), 0) AS total
        FROM expense e
        LEFT JOIN expense_category ec ON ec.id = e.category_id
        WHERE e.org_id = ${orgId}
          AND e.status = 2
          AND e.expense_date BETWEEN '2026-09-01' AND '2026-09-30'
        GROUP BY e.category_id, ec.name
        ORDER BY SUM(e.total::numeric) DESC
      `);
      const rows = (result as any).rows as Record<string, unknown>[];
      expect(rows.length).toBeGreaterThanOrEqual(1);
      expect(Number(rows[0].total)).toBe(450);
    });
  });

  describe("outstanding queries", () => {
    it("identifies overdue vs current invoices", async () => {
      // Overdue invoice (due date in the past)
      await createInvoice({
        status: INVOICE_STATUS.SENT,
        total: "1000.00",
        balance: "1000.00",
        dueDate: "2025-01-01",
        issueDate: "2024-12-01",
      });
      // Current invoice (due in the future)
      await createInvoice({
        status: INVOICE_STATUS.SENT,
        total: "500.00",
        balance: "500.00",
        dueDate: "2027-12-31",
        issueDate: "2027-01-01",
      });

      const result = await db.execute(sql`
        SELECT
          COALESCE(SUM(balance::numeric), 0) AS total,
          COUNT(*)::int AS count,
          COALESCE(SUM(CASE WHEN due_date < CURRENT_DATE THEN balance::numeric ELSE 0 END), 0) AS overdue_total,
          COALESCE(SUM(CASE WHEN due_date < CURRENT_DATE THEN 1 ELSE 0 END), 0)::int AS overdue_count
        FROM invoice
        WHERE org_id = ${orgId}
          AND status IN (2, 3)
          AND balance::numeric > 0
      `);
      const rows = (result as any).rows as Record<string, unknown>[];
      expect(Number(rows[0].overdue_total)).toBeGreaterThan(0);
      expect(Number(rows[0].overdue_count)).toBeGreaterThan(0);
      expect(Number(rows[0].total)).toBeGreaterThan(
        Number(rows[0].overdue_total),
      );
    });
  });

  describe("VAT queries", () => {
    it("groups invoice items by tax rate", async () => {
      const inv = await createInvoice({
        status: INVOICE_STATUS.PAID,
        total: "1240.00",
        issueDate: "2026-10-05",
      });
      await db.insert(invoiceItems).values([
        {
          invoiceId: inv.id,
          name: "Service A",
          quantity: "1",
          unitPrice: "1000.00",
          taxRate: "24.00",
          taxAmount: "240.00",
          lineTotal: "1240.00",
        },
        {
          invoiceId: inv.id,
          name: "Service B",
          quantity: "2",
          unitPrice: "100.00",
          taxRate: "13.00",
          taxAmount: "26.00",
          lineTotal: "226.00",
        },
      ]);

      const result = await db.execute(sql`
        SELECT ii.tax_rate,
          COALESCE(SUM(ii.quantity::numeric * ii.unit_price::numeric), 0) AS taxable_base,
          COALESCE(SUM(ii.tax_amount::numeric), 0) AS vat_amount
        FROM invoice_item ii
        JOIN invoice i ON i.id = ii.invoice_id
        WHERE i.org_id = ${orgId}
          AND i.status IN (2, 3, 4)
          AND i.issue_date BETWEEN '2026-10-01' AND '2026-10-31'
        GROUP BY ii.tax_rate
        ORDER BY ii.tax_rate DESC
      `);
      const rows = (result as any).rows as Record<string, unknown>[];
      expect(rows.length).toBe(2);
      // 24% rate should be first (DESC order)
      expect(Number(rows[0].tax_rate)).toBe(24);
      expect(Number(rows[0].taxable_base)).toBe(1000);
      expect(Number(rows[0].vat_amount)).toBe(240);
    });
  });

  describe("empty data", () => {
    it("returns zero totals for periods with no data", async () => {
      const result = await db.execute(sql`
        SELECT COALESCE(SUM(total::numeric), 0) AS total, COUNT(*)::int AS count
        FROM invoice
        WHERE org_id = ${orgId}
          AND status IN (2, 3, 4)
          AND issue_date BETWEEN '2099-01-01' AND '2099-12-31'
      `);
      const rows = (result as any).rows as Record<string, unknown>[];
      expect(Number(rows[0].total)).toBe(0);
      expect(Number(rows[0].count)).toBe(0);
    });
  });

  describe("period boundaries", () => {
    it("includes invoices exactly on start and end dates", async () => {
      await createInvoice({
        status: INVOICE_STATUS.SENT,
        total: "111.00",
        issueDate: "2026-11-01",
      });
      await createInvoice({
        status: INVOICE_STATUS.SENT,
        total: "222.00",
        issueDate: "2026-11-30",
      });

      const result = await db.execute(sql`
        SELECT COALESCE(SUM(total::numeric), 0) AS total, COUNT(*)::int AS count
        FROM invoice
        WHERE org_id = ${orgId}
          AND status IN (2, 3, 4)
          AND issue_date BETWEEN '2026-11-01' AND '2026-11-30'
      `);
      const rows = (result as any).rows as Record<string, unknown>[];
      expect(Number(rows[0].total)).toBe(333);
      expect(Number(rows[0].count)).toBe(2);
    });
  });
});
