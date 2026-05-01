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

  it("Greece provider has taxOfficeList capability", () => {
    const provider = getCountryProvider("GR");
    expect(provider.capabilities.taxOfficeList).toBe(true);
  });

  it("international provider has no special capabilities", () => {
    const provider = getCountryProvider(null);
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

  it("GR and international providers expose the plugin surface", () => {
    for (const code of [null, "GR"] as const) {
      const provider = getCountryProvider(code);
      expect(Array.isArray(provider.integrations)).toBe(true);
      expect(Array.isArray(provider.documentTypes)).toBe(true);
      expect(Array.isArray(provider.requiredContactFields)).toBe(true);
      expect(Array.isArray(provider.lineItemExtensions)).toBe(true);
      expect(Array.isArray(provider.taxRegimes)).toBe(true);
      expect(Array.isArray(provider.numberingRules)).toBe(true);
    }
  });

  it("GR provider registers the myDATA integration", () => {
    const provider = getCountryProvider("GR");
    expect(provider.integrations.length).toBeGreaterThan(0);
    const mydata = provider.integrations.find((i) => i.kind === "mydata");
    expect(mydata).toBeDefined();
    expect(mydata?.submit).toBeTypeOf("function");
    expect(mydata?.validate).toBeTypeOf("function");
  });

  it("GR provider exposes aiContext hook for the AI agent", async () => {
    const provider = getCountryProvider("GR");
    expect(provider.aiContext).toBeTypeOf("function");
    const ctx = await provider.aiContext!({ orgId: "test-org" });
    expect(ctx).toContain("VAT rates");
  });
});
