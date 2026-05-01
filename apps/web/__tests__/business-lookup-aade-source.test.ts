import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/country/providers/gr/integrations/mydata/services/aade", () => ({
  lookupGreekAfm: vi.fn(),
}));

import { aadeSource } from "../lib/business-lookup/sources/aade";
import { lookupGreekAfm } from "@/lib/country/providers/gr/integrations/mydata/services/aade";

describe("aadeSource", () => {
  beforeEach(() => vi.resetAllMocks());

  it("supports only GR", () => {
    expect(aadeSource.supports("GR")).toBe(true);
    expect(aadeSource.supports("DE")).toBe(false);
    expect(aadeSource.supports("US")).toBe(false);
  });

  it("priority is 10 (country-specific, tried before pan-EU)", () => {
    expect(aadeSource.priority).toBe(10);
  });

  it("isAvailable always resolves true (anonymous)", async () => {
    await expect(aadeSource.isAvailable("any-org-id")).resolves.toBe(true);
  });

  it("lookup returns the company when AADE finds the AFM", async () => {
    vi.mocked(lookupGreekAfm).mockResolvedValue({
      name: "ACME AE",
      address: "MAIN 1",
      city: "ATHENS",
      postalCode: "11111",
      taxOffice: "FAE ATHINON",
    });

    const result = await aadeSource.lookup("123456789", "org-1");

    expect(lookupGreekAfm).toHaveBeenCalledWith("123456789");
    expect(result?.name).toBe("ACME AE");
    expect(result?.taxOffice).toBe("FAE ATHINON");
  });

  it("lookup returns null when AADE returns null (network error or AFM not found)", async () => {
    vi.mocked(lookupGreekAfm).mockResolvedValue(null);

    const result = await aadeSource.lookup("999999999", "org-1");

    expect(result).toBeNull();
  });
});
