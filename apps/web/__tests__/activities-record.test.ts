import { describe, it, expect, vi, beforeEach } from "vitest";

// We mock the db module so the helper exercises its real branching
// (try/catch + log path) without touching Postgres.
const insertedRows: Array<Record<string, unknown>> = [];
let nextInsertImpl: () => Promise<void> = async () => {};

vi.mock("@/lib/db", () => ({
  db: {
    insert: vi.fn(() => ({
      values: vi.fn(async (row: Record<string, unknown>) => {
        await nextInsertImpl();
        insertedRows.push(row);
      }),
    })),
  },
}));

const logs: Array<{ level: string; msg: string; ctx?: unknown }> = [];
vi.mock("@/lib/logging/logger", () => ({
  createLogger: () => ({
    info: (msg: string, ctx?: unknown) =>
      logs.push({ level: "info", msg, ctx }),
    warn: (msg: string, ctx?: unknown) =>
      logs.push({ level: "warn", msg, ctx }),
    error: (msg: string, ctx?: unknown) =>
      logs.push({ level: "error", msg, ctx }),
    debug: (msg: string, ctx?: unknown) =>
      logs.push({ level: "debug", msg, ctx }),
    time: () => () => {},
  }),
}));

beforeEach(() => {
  insertedRows.length = 0;
  logs.length = 0;
  nextInsertImpl = async () => {};
});

const { recordActivity } = await import("../lib/activities/record");

describe("recordActivity (#131) — best-effort writer", () => {
  it("inserts one activity row when the DB is healthy", async () => {
    await recordActivity({
      orgId: "org-1",
      entityType: "invoice",
      entityId: "inv-1",
      userId: "user-1",
      type: "invoice.sent",
      payload: { from: "PUBLISHED", to: "SENT" },
    });

    expect(insertedRows).toHaveLength(1);
    expect(insertedRows[0]).toMatchObject({
      orgId: "org-1",
      entityType: "invoice",
      entityId: "inv-1",
      userId: "user-1",
      type: "invoice.sent",
      payload: { from: "PUBLISHED", to: "SENT" },
      isSystem: false,
    });
    // No log noise on the happy path.
    expect(logs.find((l) => l.level === "error")).toBeUndefined();
  });

  it("flags isSystem=true when userId is null (cron / system writes)", async () => {
    await recordActivity({
      orgId: "org-1",
      entityType: "invoice",
      entityId: "inv-1",
      userId: null,
      type: "mydata.confirmed",
      payload: { kind: "mydata", externalId: "401-abc" },
    });

    expect(insertedRows[0]).toMatchObject({ userId: null, isSystem: true });
  });

  it("swallows DB errors and logs them — never throws upstream", async () => {
    nextInsertImpl = async () => {
      throw new Error("connection terminated");
    };

    await expect(
      recordActivity({
        orgId: "org-1",
        entityType: "invoice",
        entityId: "inv-1",
        userId: "user-1",
        type: "invoice.created",
        payload: { status: "DRAFT" },
      }),
    ).resolves.toBeUndefined();

    expect(insertedRows).toHaveLength(0);
    const errorLog = logs.find(
      (l) => l.level === "error" && l.msg === "activity write failed",
    );
    expect(errorLog).toBeDefined();
    expect(errorLog?.ctx).toMatchObject({
      orgId: "org-1",
      entityType: "invoice",
      entityId: "inv-1",
      type: "invoice.created",
      errorMessage: "connection terminated",
    });
  });

  it("treats a missing payload as null (column is nullable)", async () => {
    await recordActivity({
      orgId: "org-1",
      entityType: "invoice",
      entityId: "inv-1",
      userId: "user-1",
      type: "invoice.deleted",
    });

    expect(insertedRows[0]).toMatchObject({ payload: null });
  });
});
