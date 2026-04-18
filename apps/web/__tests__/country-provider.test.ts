import { describe, it, expect } from "vitest";
import { getCountryProvider } from "../lib/country";

describe("getCountryProvider", () => {
  it("returns international provider for null country code", () => {
    const provider = getCountryProvider(null);
    expect(provider.code).toBe("INTL");
    expect(provider.name).toBe("International");
  });

  it("returns international provider for unknown country code", () => {
    const provider = getCountryProvider("XX");
    expect(provider.code).toBe("INTL");
  });

  it("returns Greece provider for GR", () => {
    const provider = getCountryProvider("GR");
    expect(provider.code).toBe("GR");
    expect(provider.name).toBe("Greece");
  });

  it("Greece provider has companyLookup capability", () => {
    const provider = getCountryProvider("GR");
    expect(provider.capabilities.companyLookup).toBe(true);
    expect(provider.capabilities.taxOfficeList).toBe(true);
  });

  it("Greece provider has vatReport and taxProjection capabilities", () => {
    const provider = getCountryProvider("GR");
    expect(provider.capabilities.vatReport).toBe(true);
    expect(provider.capabilities.taxProjection).toBe(true);
  });

  it("international provider has no special capabilities", () => {
    const provider = getCountryProvider(null);
    expect(provider.capabilities.companyLookup).toBe(false);
    expect(provider.capabilities.taxOfficeList).toBe(false);
    expect(provider.capabilities.eInvoicing).toBe(false);
  });

  it("Greece provider has correct VAT rates", () => {
    const provider = getCountryProvider("GR");
    const rates = provider.vatRates.map((r) => r.rate);
    expect(rates).toContain(24);
    expect(rates).toContain(13);
    expect(rates).toContain(6);
    expect(rates).toContain(0);
  });

  it("Greece provider validates Greek tax IDs", () => {
    const provider = getCountryProvider("GR");
    expect(provider.validateTaxId("123456789")).toBe(true);
    expect(provider.validateTaxId("12345678")).toBe(false);
    expect(provider.validateTaxId("1234567890")).toBe(false);
    expect(provider.validateTaxId("abcdefghi")).toBe(false);
  });

  it("Greece provider has tax offices", () => {
    const provider = getCountryProvider("GR");
    expect(provider.taxOffices).toBeDefined();
    expect(provider.taxOffices!.length).toBeGreaterThan(0);
    expect(provider.taxOffices![0]).toHaveProperty("code");
    expect(provider.taxOffices![0]).toHaveProperty("name");
  });

  it("Greece provider returns default VAT rate of 24", () => {
    const provider = getCountryProvider("GR");
    expect(provider.getDefaultVatRate()).toBe(24);
  });

  it("international provider returns default VAT rate of 0", () => {
    const provider = getCountryProvider(null);
    expect(provider.getDefaultVatRate()).toBe(0);
  });
});
