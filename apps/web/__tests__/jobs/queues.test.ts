import { describe, it, expect, vi, beforeEach } from "vitest";

const { addMock, ConnectionMock, QueueMock } = vi.hoisted(() => ({
  addMock: vi.fn().mockResolvedValue({ id: "job-1" }),
  ConnectionMock: vi.fn(),
  QueueMock: vi.fn().mockImplementation(() => ({
    add: vi.fn().mockResolvedValue({ id: "job-1" }),
  })),
}));

vi.mock("ioredis", () => ({ default: ConnectionMock }));
vi.mock("bullmq", () => ({ Queue: QueueMock }));

beforeEach(() => {
  addMock.mockClear();
  QueueMock.mockClear();
  ConnectionMock.mockClear();
  // Reset the registry between tests since queues.ts caches in-module
  vi.resetModules();
  process.env.REDIS_URL = "redis://localhost:6379";
  // Re-wire the QueueMock to return a fresh add() spy that the test can read
  QueueMock.mockImplementation(() => ({ add: addMock }));
});

describe("enqueue (#85)", () => {
  it("creates one Queue per name and calls .add with the payload + retry opts", async () => {
    const { enqueue } = await import("../../lib/jobs/queues");

    await enqueue("delete-expense-files", {
      orgId: "org-1",
      expenseId: "exp-1",
      filePaths: ["a", "b"],
    });

    expect(QueueMock).toHaveBeenCalledWith(
      "delete-expense-files",
      expect.any(Object),
    );
    expect(addMock).toHaveBeenCalledWith(
      "delete-expense-files",
      { orgId: "org-1", expenseId: "exp-1", filePaths: ["a", "b"] },
      expect.objectContaining({
        attempts: expect.any(Number),
        backoff: expect.any(Object),
      }),
    );
  });

  it("reuses the same Queue instance across calls", async () => {
    const { enqueue } = await import("../../lib/jobs/queues");
    await enqueue("delete-expense-files", {
      orgId: "o",
      expenseId: "e",
      filePaths: [],
    });
    await enqueue("delete-expense-files", {
      orgId: "o",
      expenseId: "e2",
      filePaths: [],
    });
    expect(QueueMock).toHaveBeenCalledTimes(1);
  });

  it("throws a clear error when REDIS_URL is unset", async () => {
    delete process.env.REDIS_URL;
    const { enqueue } = await import("../../lib/jobs/queues");
    await expect(
      enqueue("cleanup-temp-files", { ageHours: 24 }),
    ).rejects.toThrow(/REDIS_URL/);
  });
});
