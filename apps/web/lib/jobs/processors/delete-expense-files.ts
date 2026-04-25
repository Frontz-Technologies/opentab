import { deleteTempFile } from "@/lib/expenses/file-storage";
import { createLogger } from "@/lib/logging/logger";

const log = createLogger("job:delete-expense-files");

export async function processDeleteExpenseFiles({
  orgId,
  expenseId,
  filePaths,
}: {
  orgId: string;
  expenseId: string;
  filePaths: string[];
}): Promise<{ deleted: number }> {
  let deleted = 0;
  for (const path of filePaths) {
    await deleteTempFile(path);
    deleted++;
  }
  log.info("delete-expense-files completed", { orgId, expenseId, deleted });
  return { deleted };
}
