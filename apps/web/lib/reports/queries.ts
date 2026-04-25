import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import type {
  RevenueByCientRow,
  TimeBucketRow,
  ExpenseByCategoryRow,
  VatLineRow,
} from "./types";

type DbInstance = Pick<typeof db, "execute">;

// drizzle's `db.execute()` returns `RowList[]` for postgres-js but
// `{ rows: RowList[] }` for PGlite. Normalise so test + prod agree.
function rowsOf(result: unknown): Record<string, unknown>[] {
  if (Array.isArray(result)) return result as Record<string, unknown>[];
  if (
    result &&
    typeof result === "object" &&
    Array.isArray((result as { rows?: unknown }).rows)
  ) {
    return (result as { rows: Record<string, unknown>[] }).rows;
  }
  return [];
}

// Revenue is computed as: SUM(invoice.total) − SUM(credit_note.total)
// for the same period. Invoices count when status IN (SENT=2, PARTIAL=3,
// PAID=4); credit notes count when status IN (PUBLISHED=2, SENT=3) —
// CANCELLED is excluded on both sides.
export async function getRevenue(
  orgId: string,
  start: Date,
  end: Date,
  dbInstance: DbInstance = db,
): Promise<{ total: number; count: number }> {
  const startDate = start.toISOString().slice(0, 10);
  const endDate = end.toISOString().slice(0, 10);
  const [invResult, cnResult] = await Promise.all([
    dbInstance.execute(sql`
      SELECT COALESCE(SUM(total::numeric), 0) AS total, COUNT(*)::int AS count
      FROM invoice
      WHERE org_id = ${orgId}
        AND status IN (2, 3, 4)
        AND issue_date BETWEEN ${startDate} AND ${endDate}
    `),
    dbInstance.execute(sql`
      SELECT COALESCE(SUM(total::numeric), 0) AS credits
      FROM credit_note
      WHERE org_id = ${orgId}
        AND status IN (2, 3)
        AND issue_date BETWEEN ${startDate} AND ${endDate}
    `),
  ]);
  const invRow = rowsOf(invResult)[0] ?? { total: 0, count: 0 };
  const cnRow = rowsOf(cnResult)[0] ?? { credits: 0 };
  return {
    total: Number(invRow.total) - Number(cnRow.credits),
    count: Number(invRow.count),
  };
}

export async function getRevenueByClient(
  orgId: string,
  start: Date,
  end: Date,
): Promise<RevenueByCientRow[]> {
  const startDate = start.toISOString().slice(0, 10);
  const endDate = end.toISOString().slice(0, 10);
  const result = await db.execute(sql`
    WITH inv AS (
      SELECT contact_id, contact_name,
        SUM(total::numeric) AS total, COUNT(*)::int AS invoice_count
      FROM invoice
      WHERE org_id = ${orgId}
        AND status IN (2, 3, 4)
        AND issue_date BETWEEN ${startDate} AND ${endDate}
      GROUP BY contact_id, contact_name
    ),
    cn AS (
      SELECT contact_id, SUM(total::numeric) AS credits
      FROM credit_note
      WHERE org_id = ${orgId}
        AND status IN (2, 3)
        AND issue_date BETWEEN ${startDate} AND ${endDate}
      GROUP BY contact_id
    )
    SELECT inv.contact_id, inv.contact_name AS display_name,
      (inv.total - COALESCE(cn.credits, 0)) AS total,
      inv.invoice_count
    FROM inv
    LEFT JOIN cn ON cn.contact_id = inv.contact_id
    ORDER BY (inv.total - COALESCE(cn.credits, 0)) DESC
    LIMIT 10
  `);
  const rows = result as unknown as Record<string, unknown>[];
  return rows.map(
    (r) =>
      ({
        contactId: r.contact_id as string,
        displayName: r.display_name as string,
        total: Number(r.total),
        invoiceCount: Number(r.invoice_count),
      }) satisfies RevenueByCientRow,
  );
}

export async function getRevenueByPeriod(
  orgId: string,
  start: Date,
  end: Date,
  bucket: "day" | "week" | "month",
): Promise<TimeBucketRow[]> {
  const startDate = start.toISOString().slice(0, 10);
  const endDate = end.toISOString().slice(0, 10);
  const result = await db.execute(sql`
    WITH inv AS (
      SELECT date_trunc(${bucket}, issue_date::timestamp) AS bucket,
        SUM(total::numeric) AS total
      FROM invoice
      WHERE org_id = ${orgId}
        AND status IN (2, 3, 4)
        AND issue_date BETWEEN ${startDate} AND ${endDate}
      GROUP BY bucket
    ),
    cn AS (
      SELECT date_trunc(${bucket}, issue_date::timestamp) AS bucket,
        SUM(total::numeric) AS credits
      FROM credit_note
      WHERE org_id = ${orgId}
        AND status IN (2, 3)
        AND issue_date BETWEEN ${startDate} AND ${endDate}
      GROUP BY bucket
    )
    SELECT COALESCE(inv.bucket, cn.bucket) AS bucket,
      (COALESCE(inv.total, 0) - COALESCE(cn.credits, 0)) AS total
    FROM inv
    FULL OUTER JOIN cn ON inv.bucket = cn.bucket
    ORDER BY bucket
  `);
  const rows = result as unknown as Record<string, unknown>[];
  return rows.map((r) => ({
    bucket: String(r.bucket).slice(0, 10),
    total: Number(r.total),
  }));
}

export async function getExpenseTotal(
  orgId: string,
  start: Date,
  end: Date,
): Promise<{ total: number; count: number }> {
  const result = await db.execute(sql`
    SELECT COALESCE(SUM(total::numeric), 0) AS total, COUNT(*)::int AS count
    FROM expense
    WHERE org_id = ${orgId}
      AND expense_date BETWEEN ${start.toISOString().slice(0, 10)} AND ${end.toISOString().slice(0, 10)}
  `);
  const row = (result as unknown as Record<string, unknown>[])[0];
  return { total: Number(row.total), count: Number(row.count) };
}

export async function getExpensesByCategory(
  orgId: string,
  start: Date,
  end: Date,
): Promise<ExpenseByCategoryRow[]> {
  const startDate = start.toISOString().slice(0, 10);
  const endDate = end.toISOString().slice(0, 10);
  const result = await db.execute(sql`
    SELECT e.category_id, COALESCE(ec.name, 'Uncategorized') AS category,
      COALESCE(SUM(e.total::numeric), 0) AS total
    FROM expense e
    LEFT JOIN expense_category ec ON ec.id = e.category_id
    WHERE e.org_id = ${orgId}
      AND e.expense_date BETWEEN ${startDate} AND ${endDate}
    GROUP BY e.category_id, ec.name
    ORDER BY SUM(e.total::numeric) DESC
  `);
  const rows = result as unknown as Array<Record<string, unknown>>;
  const totalExpenses = rows.reduce((sum, r) => sum + Number(r.total), 0);
  return rows.map(
    (r) =>
      ({
        categoryId: (r.category_id as string) ?? "",
        category: r.category as string,
        total: Number(r.total),
        percentage:
          totalExpenses > 0
            ? Math.round((Number(r.total) / totalExpenses) * 1000) / 10
            : 0,
      }) satisfies ExpenseByCategoryRow,
  );
}

export async function getOutstanding(orgId: string): Promise<{
  total: number;
  overdueTotal: number;
  count: number;
  overdueCount: number;
}> {
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
  const row = (result as unknown as Record<string, unknown>[])[0];
  return {
    total: Number(row.total),
    overdueTotal: Number(row.overdue_total),
    count: Number(row.count),
    overdueCount: Number(row.overdue_count),
  };
}

export async function getOutputVat(
  orgId: string,
  start: Date,
  end: Date,
): Promise<VatLineRow[]> {
  const result = await db.execute(sql`
    SELECT ii.tax_rate,
      COALESCE(SUM(ii.quantity::numeric * ii.unit_price::numeric), 0) AS taxable_base,
      COALESCE(SUM(ii.tax_amount::numeric), 0) AS vat_amount
    FROM invoice_item ii
    JOIN invoice i ON i.id = ii.invoice_id
    WHERE i.org_id = ${orgId}
      AND i.status IN (2, 3, 4)
      AND i.issue_date BETWEEN ${start.toISOString().slice(0, 10)} AND ${end.toISOString().slice(0, 10)}
    GROUP BY ii.tax_rate
    ORDER BY ii.tax_rate DESC
  `);
  const rows = result as unknown as Record<string, unknown>[];
  return rows.map((r) => ({
    rate: Number(r.tax_rate),
    label: `${Number(r.tax_rate)}%`,
    taxableBase: Number(r.taxable_base),
    vatAmount: Number(r.vat_amount),
  }));
}

export async function getInputVat(
  orgId: string,
  start: Date,
  end: Date,
): Promise<VatLineRow[]> {
  const result = await db.execute(sql`
    SELECT ei.tax_rate,
      COALESCE(SUM(ei.quantity::numeric * ei.unit_price::numeric), 0) AS taxable_base,
      COALESCE(SUM(ei.tax_amount::numeric), 0) AS vat_amount
    FROM expense_item ei
    JOIN expense e ON e.id = ei.expense_id
    WHERE e.org_id = ${orgId}
      AND e.expense_date BETWEEN ${start.toISOString().slice(0, 10)} AND ${end.toISOString().slice(0, 10)}
    GROUP BY ei.tax_rate
    ORDER BY ei.tax_rate DESC
  `);
  const rows = result as unknown as Record<string, unknown>[];
  return rows.map((r) => ({
    rate: Number(r.tax_rate),
    label: `${Number(r.tax_rate)}%`,
    taxableBase: Number(r.taxable_base),
    vatAmount: Number(r.vat_amount),
  }));
}

export async function getExpensesByPeriod(
  orgId: string,
  start: Date,
  end: Date,
  bucket: "day" | "week" | "month",
): Promise<TimeBucketRow[]> {
  const result = await db.execute(sql`
    SELECT date_trunc(${bucket}, expense_date::timestamp) AS bucket,
      COALESCE(SUM(total::numeric), 0) AS total
    FROM expense
    WHERE org_id = ${orgId}
      AND expense_date BETWEEN ${start.toISOString().slice(0, 10)} AND ${end.toISOString().slice(0, 10)}
    GROUP BY bucket
    ORDER BY bucket
  `);
  const rows = result as unknown as Record<string, unknown>[];
  return rows.map((r) => ({
    bucket: String(r.bucket).slice(0, 10),
    total: Number(r.total),
  }));
}

export async function getCashFlowData(
  orgId: string,
  start: Date,
  end: Date,
  bucket: "day" | "week" | "month" = "day",
): Promise<{ revenue: TimeBucketRow[]; expenses: TimeBucketRow[] }> {
  const [revenue, expenses] = await Promise.all([
    getRevenueByPeriod(orgId, start, end, bucket),
    getExpensesByPeriod(orgId, start, end, bucket),
  ]);
  return { revenue, expenses };
}
