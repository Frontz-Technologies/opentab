import { describe, it, expect } from "vitest";
import { getCountryProvider } from "../lib/country";

const ALL_GROUP_CODES = [
  "rent",
  "utilities",
  "telecom",
  "office_supplies",
  "software",
  "hardware",
  "professional_services",
  "marketing",
  "travel",
  "transport",
  "insurance",
  "meals_entertainment",
  "bank_fees",
  "training",
  "taxes_contributions",
  "other",
];

describe("mapGroupToTaxCode", () => {
  describe("GR provider", () => {
    const provider = getCountryProvider("GR");

    it("returns E3_585_003 for rent", () => {
      const mapping = provider.mapGroupToTaxCode!("rent");
      expect(mapping).not.toBeNull();
      expect(mapping!.taxCode).toBe("E3_585_003");
    });

    it("returns E3_585_007 for utilities", () => {
      const mapping = provider.mapGroupToTaxCode!("utilities");
      expect(mapping).not.toBeNull();
      expect(mapping!.taxCode).toBe("E3_585_007");
    });

    it("returns E3_585_007 for telecom (same as utilities)", () => {
      const mapping = provider.mapGroupToTaxCode!("telecom");
      expect(mapping).not.toBeNull();
      expect(mapping!.taxCode).toBe("E3_585_007");
    });

    it("returns E3_585_001 for office_supplies", () => {
      const mapping = provider.mapGroupToTaxCode!("office_supplies");
      expect(mapping).not.toBeNull();
      expect(mapping!.taxCode).toBe("E3_585_001");
    });

    it("returns null for unknown group code", () => {
      const mapping = provider.mapGroupToTaxCode!("nonexistent");
      expect(mapping).toBeNull();
    });

    it("returns a mapping for all 16 standard group codes", () => {
      for (const code of ALL_GROUP_CODES) {
        const mapping = provider.mapGroupToTaxCode!(code);
        expect(mapping).not.toBeNull();
        expect(mapping!.taxCode).toBeTruthy();
        expect(mapping!.deductibility).toBeTruthy();
      }
    });
  });

  describe("International provider", () => {
    const provider = getCountryProvider(null);

    it("returns null for all group codes", () => {
      for (const code of ALL_GROUP_CODES) {
        const mapping = provider.mapGroupToTaxCode!(code);
        expect(mapping).toBeNull();
      }
    });

    it("returns null for rent", () => {
      const mapping = provider.mapGroupToTaxCode!("rent");
      expect(mapping).toBeNull();
    });
  });
});
