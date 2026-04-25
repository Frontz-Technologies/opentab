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
    const { processDeleteExpenseFiles } = await import(
      "../../../lib/jobs/processors/delete-expense-files"
    );

    const result = await processDeleteExpenseFiles({
      orgId: "org-1",
      expenseId: "exp-1",
      filePaths: ["a/b.pdf", "a/c.pdf", "a/d.pdf"],
    });

    expect(deleteTempFileMock).toHaveBeenCalledTimes(3);
    expect(deleteTempFileMock).toHaveBeenNthCalledWith(1, "a/b.pdf");
    expect(deleteTempFileMock).toHaveBeenNthCalledWith(2, "a/c.pdf");
    expect(deleteTempFileMock).toHaveBeenNthCalledWith(3, "a/d.pdf");
    expect(result.deleted).toBe(3);
  });

  it("returns deleted=0 for an empty file list", async () => {
    const { processDeleteExpenseFiles } = await import(
      "../../../lib/jobs/processors/delete-expense-files"
    );
    const result = await processDeleteExpenseFiles({
      orgId: "org-1",
      expenseId: "exp-1",
      filePaths: [],
    });
    expect(deleteTempFileMock).not.toHaveBeenCalled();
    expect(result.deleted).toBe(0);
  });
});
