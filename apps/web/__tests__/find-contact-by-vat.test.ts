import { describe, it, expect, vi, beforeEach } from "vitest";

const { dbSelectMock, eqMock, eqCalls } = vi.hoisted(() => ({
  dbSelectMock: vi.fn(),
  eqMock: vi.fn(),
  eqCalls: [] as unknown[][],
}));
const { sessionMock } = vi.hoisted(() => ({ sessionMock: vi.fn() }));

vi.mock("@/lib/db", () => ({
  db: { select: dbSelectMock },
}));
vi.mock("@/lib/session", () => ({
  getSession: sessionMock,
}));
vi.mock("drizzle-orm", async () => {
  const actual =
    await vi.importActual<typeof import("drizzle-orm")>("drizzle-orm");
  return {
    ...actual,
    eq: (...args: unknown[]) => {
      eqCalls.push(args);
      eqMock(...args);
      return args;
    },
    and: (...args: unknown[]) => args,
  };
});

import { findContactByVat } from "../app/(app)/expenses/actions";

function selectChain(rows: unknown[]) {
  return {
    from: () => ({
      where: () => ({
        limit: () => Promise.resolve(rows),
      }),
    }),
  };
}

describe("findContactByVat", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    eqCalls.length = 0;
    sessionMock.mockResolvedValue({ org: { id: "org-1" } });
  });

  it("returns null when VAT is empty after normalization", async () => {
    dbSelectMock.mockReturnValue(selectChain([]));
    const out = await findContactByVat("   ");
    expect(out).toBeNull();
    expect(dbSelectMock).not.toHaveBeenCalled();
  });

  it("normalizes (trim + uppercase + strip whitespace) before querying", async () => {
    dbSelectMock.mockReturnValue({
      from: () => ({
        where: () => ({ limit: () => Promise.resolve([]) }),
      }),
    });
    await findContactByVat("  el 123 456 789  ");
    const vatComparisons = eqCalls.flat().filter((a) => a === "EL123456789");
    expect(vatComparisons.length).toBeGreaterThan(0);
  });

  it("returns the first matching contact", async () => {
    const fake = { id: "c-1", displayName: "ACME", vatNumber: "EL123" };
    dbSelectMock.mockReturnValue(selectChain([fake]));
    const out = await findContactByVat("EL123");
    expect(out).toEqual(fake);
  });

  it("returns null when no rows match", async () => {
    dbSelectMock.mockReturnValue(selectChain([]));
    const out = await findContactByVat("EL999");
    expect(out).toBeNull();
  });

  it("throws Unauthorized when no session", async () => {
    sessionMock.mockResolvedValue(null);
    await expect(findContactByVat("EL123")).rejects.toThrow("Unauthorized");
  });
});
