import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/country/services/vies", () => ({
  validateViesVat: vi.fn(),
}));

import { viesSource } from "../lib/business-lookup/sources/vies";
import { validateViesVat } from "@/lib/country/services/vies";

describe("viesSource", () => {
  beforeEach(() => vi.resetAllMocks());

  it("supports all 27 EU country codes and rejects others", () => {
    expect(viesSource.supports("GR")).toBe(true);
    expect(viesSource.supports("DE")).toBe(true);
    expect(viesSource.supports("IT")).toBe(true);
    expect(viesSource.supports("GB")).toBe(false);
    expect(viesSource.supports("US")).toBe(false);
    expect(viesSource.supports("XX")).toBe(false);
  });

  it("priority is 50 (pan-EU fallback)", () => {
    expect(viesSource.priority).toBe(50);
  });

  it("isAvailable always resolves true (anonymous)", async () => {
    await expect(viesSource.isAvailable("any-org-id")).resolves.toBe(true);
  });

  it("lookup returns the company when VIES validates with a name", async () => {
    vi.mocked(validateViesVat).mockResolvedValue({
      valid: true,
      company: { name: "ACME LTD", address: "MAIN ST 1" },
    });

    const result = await viesSource.lookup("GR123456789", "org-1");

    expect(validateViesVat).toHaveBeenCalledWith("GR123456789");
    expect(result).toEqual({ name: "ACME LTD", address: "MAIN ST 1" });
  });

  it("lookup returns null when VIES is invalid", async () => {
    vi.mocked(validateViesVat).mockResolvedValue({
      valid: false,
      company: null,
    });

    const result = await viesSource.lookup("GR000000000", "org-1");

    expect(result).toBeNull();
  });

  it("lookup returns null when VIES validates but the name is empty (DE/AT privacy)", async () => {
    vi.mocked(validateViesVat).mockResolvedValue({
      valid: true,
      company: { name: "", address: undefined },
    });

    const result = await viesSource.lookup("DE123456789", "org-1");

    expect(result).toBeNull();
  });
});
