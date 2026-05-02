import { describe, it, expect, vi, beforeEach } from "vitest";

const deleteTempFileMock = vi.hoisted(() =>
  vi.fn().mockResolvedValue(undefined),
);
vi.mock("@/lib/expenses/file-storage", () => ({
  deleteTempFile: deleteTempFileMock,
}));

beforeEach(() => deleteTempFileMock.mockClear());

describe("delete-expense-files processor (#85)", () => {
  it("calls deleteTempFile once per file path in the payload", async () => {
    const { processDeleteExpenseFiles } =
      await import("../../../lib/jobs/processors/delete-expense-files");

    const result = await processDeleteExpenseFiles({
      orgId: "org-1",
      expenseId: "exp-1",
      filePaths: [
        "org-1/expenses/b.pdf",
        "org-1/expenses/c.pdf",
        "org-1/expenses/d.pdf",
      ],
    });

    expect(deleteTempFileMock).toHaveBeenCalledTimes(3);
    expect(deleteTempFileMock).toHaveBeenNthCalledWith(
      1,
      "org-1/expenses/b.pdf",
    );
    expect(deleteTempFileMock).toHaveBeenNthCalledWith(
      2,
      "org-1/expenses/c.pdf",
    );
    expect(deleteTempFileMock).toHaveBeenNthCalledWith(
      3,
      "org-1/expenses/d.pdf",
    );
    expect(result.deleted).toBe(3);
  });

  // Defence-in-depth at the boundary: the processor must reject
  // obviously-invalid payloads so a poisoned Redis value can't
  // trigger a path-traversal delete.
  it("throws on missing orgId / expenseId / filePaths shape", async () => {
    const { processDeleteExpenseFiles } =
      await import("../../../lib/jobs/processors/delete-expense-files");
    await expect(
      processDeleteExpenseFiles({
        orgId: "",
        expenseId: "exp-1",
        filePaths: [],
      } as { orgId: string; expenseId: string; filePaths: string[] }),
    ).rejects.toThrow();
    await expect(
      processDeleteExpenseFiles({
        orgId: "org-1",
        expenseId: "exp-1",
        filePaths: ["../../etc/passwd"],
      }),
    ).rejects.toThrow();
    expect(deleteTempFileMock).not.toHaveBeenCalled();
  });

  it("returns deleted=0 for an empty file list", async () => {
    const { processDeleteExpenseFiles } =
      await import("../../../lib/jobs/processors/delete-expense-files");
    const result = await processDeleteExpenseFiles({
      orgId: "org-1",
      expenseId: "exp-1",
      filePaths: [],
    });
    expect(deleteTempFileMock).not.toHaveBeenCalled();
    expect(result.deleted).toBe(0);
  });
});
