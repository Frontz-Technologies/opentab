import { createHash } from "crypto";
import { db } from "@/lib/db";
import { expenses, expenseAttachments } from "@opentab/db/schema";
import { eq, and } from "drizzle-orm";

export function computeFileHash(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

export interface DuplicateCheckResult {
  isDuplicate: boolean;
  existingExpense?: {
    id: string;
    number: string;
    date: string;
  };
}

export async function checkDuplicate(
  orgId: string,
  fileHash: string,
): Promise<DuplicateCheckResult> {
  const existing = await db
    .select({
      id: expenses.id,
      number: expenses.expenseNumber,
      date: expenses.issueDate,
    })
    .from(expenses)
    .innerJoin(
      expenseAttachments,
      eq(expenseAttachments.expenseId, expenses.id),
    )
    .where(
      and(eq(expenses.orgId, orgId), eq(expenseAttachments.fileHash, fileHash)),
    )
    .limit(1);

  if (existing.length > 0) {
    return { isDuplicate: true, existingExpense: existing[0] };
  }
  return { isDuplicate: false };
}
