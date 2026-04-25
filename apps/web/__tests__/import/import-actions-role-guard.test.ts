import { describe, it, expect, vi, beforeEach } from "vitest";

const { getSessionMock, dbSpy } = vi.hoisted(() => ({
  getSessionMock: vi.fn(),
  dbSpy: vi.fn(),
}));

vi.mock("@/lib/session", () => ({ getSession: getSessionMock }));
vi.mock("@/lib/db", () => ({
  db: new Proxy(
    {},
    {
      get: () => {
        dbSpy();
        throw new Error("db should not be touched");
      },
    },
  ),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/activities/record", () => ({ recordActivity: vi.fn() }));

import {
  commitImport,
  getSampleCsv,
} from "../../app/(app)/import/[entity]/actions";

describe("commitImport / getSampleCsv role guard (#215)", () => {
  beforeEach(() => {
    getSessionMock.mockReset();
    dbSpy.mockReset();
  });

  it("commitImport throws Unauthorized when no session", async () => {
    getSessionMock.mockResolvedValue(null);
    await expect(
      commitImport({
        entityKey: "contacts",
        rows: [],
        mapping: {},
        skippedByUser: [],
        autoCreateToggles: {},
      }),
    ).rejects.toThrow(/Unauthorized/);
    expect(dbSpy).not.toHaveBeenCalled();
  });

  it("commitImport throws Forbidden for member sessions", async () => {
    getSessionMock.mockResolvedValue({
      org: { id: "o" },
      user: { id: "u" },
      role: "member",
    });
    await expect(
      commitImport({
        entityKey: "contacts",
        rows: [],
        mapping: {},
        skippedByUser: [],
        autoCreateToggles: {},
      }),
    ).rejects.toThrow(/Forbidden/);
    expect(dbSpy).not.toHaveBeenCalled();
  });

  it("commitImport throws Forbidden for accountant sessions", async () => {
    getSessionMock.mockResolvedValue({
      org: { id: "o" },
      user: { id: "u" },
      role: "accountant",
    });
    await expect(
      commitImport({
        entityKey: "contacts",
        rows: [],
        mapping: {},
        skippedByUser: [],
        autoCreateToggles: {},
      }),
    ).rejects.toThrow(/Forbidden/);
  });

  it("getSampleCsv throws Unauthorized when no session", async () => {
    getSessionMock.mockResolvedValue(null);
    await expect(getSampleCsv("contacts")).rejects.toThrow(/Unauthorized/);
  });

  it("getSampleCsv throws Forbidden for member sessions", async () => {
    getSessionMock.mockResolvedValue({
      org: { id: "o" },
      user: { id: "u" },
      role: "member",
    });
    await expect(getSampleCsv("contacts")).rejects.toThrow(/Forbidden/);
  });
});
