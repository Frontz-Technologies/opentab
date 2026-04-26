import { describe, it, expect, vi } from "vitest";

const dbExecMock = vi.fn().mockResolvedValue([{ "?column?": 1 }]);
const redisPingMock = vi.fn().mockResolvedValue("PONG");

vi.mock("@/lib/db", () => ({
  db: { execute: (...args: unknown[]) => dbExecMock(...args) },
}));
vi.mock("@/lib/jobs/queues", () => ({
  getRedisConnection: () => ({ ping: (...args: unknown[]) => redisPingMock(...args) }),
}));

import { GET } from "../../app/api/healthz/route";

describe("healthz route (#224)", () => {
  it("returns 200 with status: ok when db + redis are up", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ status: "ok", db: "ok", redis: "ok" });
  });

  it("returns 503 when db is down", async () => {
    dbExecMock.mockRejectedValueOnce(new Error("db dead"));
    const res = await GET();
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.db).toBe("fail");
  });

  it("returns 503 when redis is down", async () => {
    redisPingMock.mockRejectedValueOnce(new Error("redis dead"));
    const res = await GET();
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.redis).toBe("fail");
  });
});
