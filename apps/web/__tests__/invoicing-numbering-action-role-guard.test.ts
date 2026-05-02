import { describe, it, expect, vi, beforeEach } from "vitest";

// updateInvoiceNumbering must reject non-admin/non-owner sessions
// before touching the DB. Every other Organisation-section action
// enforces the same gate; this test proves the action mirrors that
// contract.
const { getSessionMock, dbSpy } = vi.hoisted(() => ({
  getSessionMock: vi.fn(),
  dbSpy: vi.fn(),
}));

vi.mock("@/lib/session", () => ({
  getSession: getSessionMock,
}));

// Stub the DB layer — the assertion is "throws before reaching DB",
// so any access to db should bubble as a test failure.
vi.mock("@/lib/db", () => ({
  db: new Proxy(
    {},
    {
      get: () => {
        dbSpy();
        throw new Error("db should not have been touched");
      },
    },
  ),
}));

// Avoid pulling next/cache (which requires the next runtime).
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { updateInvoiceNumbering } from "../app/(app)/settings/numbering/actions";

describe("updateInvoiceNumbering role guard (#138 / PR #213 fix)", () => {
  beforeEach(() => {
    getSessionMock.mockReset();
    dbSpy.mockReset();
  });

  function makeFormData(): FormData {
    const fd = new FormData();
    fd.set("prefix", "INV-");
    fd.set("digitCount", "4");
    fd.set("includeYear", "false");
    fd.set("pattern", "");
    return fd;
  }

  it("throws Unauthorized when there is no session", async () => {
    getSessionMock.mockResolvedValue(null);
    await expect(updateInvoiceNumbering(makeFormData())).rejects.toThrow(
      /Unauthorized/,
    );
    expect(dbSpy).not.toHaveBeenCalled();
  });

  it("throws Forbidden for member sessions", async () => {
    getSessionMock.mockResolvedValue({
      org: { id: "org-1" },
      user: { id: "user-1" },
      role: "member",
    });
    await expect(updateInvoiceNumbering(makeFormData())).rejects.toThrow(
      /Forbidden/,
    );
    expect(dbSpy).not.toHaveBeenCalled();
  });

  it("throws Forbidden for accountant sessions", async () => {
    getSessionMock.mockResolvedValue({
      org: { id: "org-1" },
      user: { id: "user-1" },
      role: "accountant",
    });
    await expect(updateInvoiceNumbering(makeFormData())).rejects.toThrow(
      /Forbidden/,
    );
    expect(dbSpy).not.toHaveBeenCalled();
  });
});
