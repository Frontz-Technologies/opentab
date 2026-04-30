import { and, eq } from "drizzle-orm";
import { db as defaultDb } from "@/lib/db";
import { expenses } from "@opentab/db/schema";

type Db = typeof defaultDb;

export interface ExpenseSeed {
  contactId: string | null;
  contactName: string;
  categoryId: string | null;
  currencyCode: string;
  usesInclusiveTax: boolean;
  description: string;
  notes: string;
}

export async function loadSeedFromSource(
  db: Db,
  orgId: string,
  sourceId: string | null,
): Promise<ExpenseSeed | null> {
  if (!sourceId) return null;
  const [row] = await db
    .select()
    .from(expenses)
    .where(and(eq(expenses.orgId, orgId), eq(expenses.id, sourceId)))
    .limit(1);
  if (!row) return null;
  return {
    contactId: row.contactId ?? null,
    contactName: row.contactName ?? "",
    categoryId: row.categoryId ?? null,
    currencyCode: row.currencyCode,
    usesInclusiveTax: row.usesInclusiveTax ?? false,
    description: row.description ?? "",
    notes: row.notes ?? "",
  };
}
