import { z } from "zod";
import { deleteTempFile } from "@/lib/expenses/file-storage";
import { createLogger } from "@/lib/logging/logger";

const log = createLogger("job:delete-expense-files");

// Boundary validation, defence-in-depth. Reject obviously-invalid
// payloads so a poisoned Redis value can't trigger a path-traversal
// delete via a forged filePath. orgId + expenseId are non-empty by
// contract; filePaths must start with the org id (every storeFile
// call writes to `<orgId>/expenses/...`) and must not contain a
// parent-directory segment.
const deleteExpenseFilesPayloadSchema = z
  .object({
    orgId: z.string().min(1),
    expenseId: z.string().min(1),
    filePaths: z.array(z.string().min(1)),
  })
  .refine(
    (p) =>
      p.filePaths.every(
        (fp) => fp.startsWith(`${p.orgId}/`) && !fp.includes(".."),
      ),
    {
      message:
        "filePaths must start with orgId/ and contain no parent-dir segment",
    },
  );

export async function processDeleteExpenseFiles(
  rawPayload: unknown,
): Promise<{ deleted: number }> {
  const { orgId, expenseId, filePaths } =
    deleteExpenseFilesPayloadSchema.parse(rawPayload);

  let deleted = 0;
  for (const path of filePaths) {
    await deleteTempFile(path);
    deleted++;
  }
  log.info("delete-expense-files completed", { orgId, expenseId, deleted });
  return { deleted };
}
