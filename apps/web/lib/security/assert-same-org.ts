import { and, eq, inArray } from "drizzle-orm";
import {
  contacts,
  expenseCategories,
  invoices,
  products,
} from "@opentab/db/schema";
import { db as defaultDb } from "@/lib/db";
import type { Db } from "@opentab/db";

/**
 * Cross-org guard helpers.
 *
 * These helpers close the data-integrity gap on the WRITE side: every
 * cross-table FK accepted by an insert/update action is verified to
 * belong to the session's org BEFORE the write hits the DB. Read
 * paths apply the same scope at the SELECT site.
 *
 * Convention: throw `Error("cross-org-access")`. Callers either let it
 * propagate (matches the existing Forbidden pattern; the action will
 * surface as an Internal Server Error to a malicious caller) or wrap
 * in try/catch when the action returns a structured error result.
 *
 * Per-table wrappers — drizzle-orm's `Table` typing makes a generic
 * `<T extends Table & { id; orgId }>` constraint awkward to satisfy
 * across mixed dialects, so we lean on per-table functions instead.
 * Concise to call from action sites and easy to grep for.
 */

const CROSS_ORG = "cross-org-access";

export async function assertContactInOrg(
  db: Db,
  id: string,
  orgId: string,
): Promise<void> {
  const [row] = await db
    .select({ id: contacts.id })
    .from(contacts)
    .where(and(eq(contacts.id, id), eq(contacts.orgId, orgId)))
    .limit(1);
  if (!row) throw new Error(CROSS_ORG);
}

export async function assertExpenseCategoryInOrg(
  db: Db,
  id: string,
  orgId: string,
): Promise<void> {
  const [row] = await db
    .select({ id: expenseCategories.id })
    .from(expenseCategories)
    .where(
      and(eq(expenseCategories.id, id), eq(expenseCategories.orgId, orgId)),
    )
    .limit(1);
  if (!row) throw new Error(CROSS_ORG);
}

export async function assertInvoiceInOrg(
  db: Db,
  id: string,
  orgId: string,
): Promise<void> {
  const [row] = await db
    .select({ id: invoices.id })
    .from(invoices)
    .where(and(eq(invoices.id, id), eq(invoices.orgId, orgId)))
    .limit(1);
  if (!row) throw new Error(CROSS_ORG);
}

/**
 * Batch variant for line-item arrays — one query for N productIds.
 * Empty / all-null id lists are no-ops.
 */
export async function assertProductsInOrg(
  db: Db,
  ids: string[],
  orgId: string,
): Promise<void> {
  if (ids.length === 0) return;
  const rows = await db
    .select({ id: products.id })
    .from(products)
    .where(and(inArray(products.id, ids), eq(products.orgId, orgId)));
  // Compare against unique input ids — duplicates in `ids` shouldn't
  // require duplicate rows.
  const found = new Set(rows.map((r) => r.id));
  for (const id of ids) {
    if (!found.has(id)) throw new Error(CROSS_ORG);
  }
}

/**
 * Sentinel exported so tests and callers can match on it without
 * relying on string equality of the message.
 */
export const CROSS_ORG_ACCESS_ERROR = CROSS_ORG;
