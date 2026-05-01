import { describe, it, expect, vi, beforeEach } from "vitest";

const { dbSelectMock, dbInsertMock, eqCalls } = vi.hoisted(() => ({
  dbSelectMock: vi.fn(),
  dbInsertMock: vi.fn(),
  eqCalls: [] as unknown[][],
}));
const { sessionMock } = vi.hoisted(() => ({ sessionMock: vi.fn() }));

vi.mock("@/lib/db", () => ({
  db: { select: dbSelectMock, insert: dbInsertMock },
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
      return args;
    },
    and: (...args: unknown[]) => args,
  };
});
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));
vi.mock("@/lib/utils", () => ({
  detectCountryFromTaxId: () => "GR",
}));

import { createSupplierContact } from "../app/(app)/expenses/actions";

function selectChain(rows: unknown[]) {
  return {
    from: () => ({
      where: () => ({
        limit: () => Promise.resolve(rows),
      }),
    }),
  };
}

function insertChain(returned: unknown) {
  return {
    values: () => ({
      returning: () => Promise.resolve([returned]),
    }),
  };
}

describe("createSupplierContact", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    eqCalls.length = 0;
    sessionMock.mockResolvedValue({
      org: { id: "org-1", countryCode: "GR" },
    });
  });

  it("rejects when name is empty after trimming", async () => {
    const out = await createSupplierContact({
      supplierName: "   ",
      supplierVat: "EL123",
    });
    expect(out.success).toBe(false);
    expect(dbInsertMock).not.toHaveBeenCalled();
  });

  it("returns the existing contact and skips INSERT when VAT already matches", async () => {
    const existing = {
      id: "c-1",
      displayName: "ACME",
      company: "ACME",
      vatNumber: "EL123",
      type: "supplier",
    };
    dbSelectMock.mockReturnValue(selectChain([existing]));

    const out = await createSupplierContact({
      supplierName: "Different Name",
      supplierVat: "el 123",
    });

    expect(out.success).toBe(true);
    if (out.success) {
      expect(out.contact).toEqual(existing);
    }
    expect(dbInsertMock).not.toHaveBeenCalled();
  });

  it("INSERTs a new contact when no VAT match exists", async () => {
    dbSelectMock.mockReturnValue(selectChain([]));
    const inserted = {
      id: "c-2",
      displayName: "New Vendor",
      company: "New Vendor",
      vatNumber: "EL999",
      type: "supplier",
    };
    dbInsertMock.mockReturnValue(insertChain(inserted));

    const out = await createSupplierContact({
      supplierName: "New Vendor",
      supplierVat: "EL999",
    });

    expect(dbInsertMock).toHaveBeenCalledOnce();
    expect(out.success).toBe(true);
    if (out.success) {
      expect(out.contact.id).toBe("c-2");
    }
  });

  it("skips dedupe SELECT when VAT is empty (still INSERTs)", async () => {
    const inserted = {
      id: "c-3",
      displayName: "No-VAT Supplier",
      company: "No-VAT Supplier",
      vatNumber: null,
      type: "supplier",
    };
    dbInsertMock.mockReturnValue(insertChain(inserted));

    const out = await createSupplierContact({
      supplierName: "No-VAT Supplier",
      supplierVat: "",
    });

    expect(dbSelectMock).not.toHaveBeenCalled();
    expect(dbInsertMock).toHaveBeenCalledOnce();
    expect(out.success).toBe(true);
  });
});
