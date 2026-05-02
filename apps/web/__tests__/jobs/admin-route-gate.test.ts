import { describe, it, expect, vi, beforeEach } from "vitest";

const { getSessionMock } = vi.hoisted(() => ({
  getSessionMock: vi.fn(),
}));

vi.mock("@/lib/session", () => ({ getSession: getSessionMock }));
vi.mock("@bull-board/api", () => ({
  createBullBoard: vi.fn(() => ({
    addQueue: vi.fn(),
    setQueues: vi.fn(),
  })),
}));
vi.mock("@bull-board/api/bullMQAdapter", () => ({
  BullMQAdapter: vi.fn(),
}));
vi.mock("@bull-board/express", () => ({
  ExpressAdapter: vi.fn().mockImplementation(() => ({
    setBasePath: vi.fn(),
    getRouter: vi.fn(
      () => (_req: unknown, _res: unknown, next: () => void) => next(),
    ),
  })),
}));
vi.mock("@/lib/jobs/queues", () => ({
  getRegisteredQueues: () => [],
}));

beforeEach(() => {
  getSessionMock.mockReset();
  delete process.env.ENABLE_QUEUE_DASHBOARD;
});

describe("/admin/queues gate", () => {
  it("404s when ENABLE_QUEUE_DASHBOARD is unset", async () => {
    getSessionMock.mockResolvedValue({
      org: { id: "o" },
      user: { id: "u" },
      role: "owner",
    });
    const { GET } = await import("../../app/admin/queues/[[...path]]/route");
    const res = await GET(new Request("http://localhost/admin/queues"));
    expect(res.status).toBe(404);
  });

  it("404s when role is not owner|admin", async () => {
    process.env.ENABLE_QUEUE_DASHBOARD = "true";
    getSessionMock.mockResolvedValue({
      org: { id: "o" },
      user: { id: "u" },
      role: "member",
    });
    const { GET } = await import("../../app/admin/queues/[[...path]]/route");
    const res = await GET(new Request("http://localhost/admin/queues"));
    expect(res.status).toBe(404);
  });

  it("404s when there is no session", async () => {
    process.env.ENABLE_QUEUE_DASHBOARD = "true";
    getSessionMock.mockResolvedValue(null);
    const { GET } = await import("../../app/admin/queues/[[...path]]/route");
    const res = await GET(new Request("http://localhost/admin/queues"));
    expect(res.status).toBe(404);
  });

  it("404s when ENABLE_QUEUE_DASHBOARD is anything other than 'true'", async () => {
    process.env.ENABLE_QUEUE_DASHBOARD = "1"; // truthy-ish but not "true"
    getSessionMock.mockResolvedValue({
      org: { id: "o" },
      user: { id: "u" },
      role: "admin",
    });
    const { GET } = await import("../../app/admin/queues/[[...path]]/route");
    const res = await GET(new Request("http://localhost/admin/queues"));
    expect(res.status).toBe(404);
  });
});
