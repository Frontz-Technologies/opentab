import { describe, it, expect } from "vitest";
import {
  detectCountryFromTaxId,
  slugify,
  generateUniqueSlug,
} from "@/lib/utils";

describe("detectCountryFromTaxId", () => {
  it("detects Greek AFM (9 digits)", () => {
    expect(detectCountryFromTaxId("123456789")).toBe("GR");
  });
  it("detects Greek AFM with spaces", () => {
    expect(detectCountryFromTaxId(" 123456789 ")).toBe("GR");
  });
  it("detects EU VAT with country prefix", () => {
    expect(detectCountryFromTaxId("DE123456789")).toBe("DE");
    expect(detectCountryFromTaxId("FR12345678901")).toBe("FR");
    expect(detectCountryFromTaxId("IT12345678901")).toBe("IT");
  });
  it("returns null for unrecognized formats", () => {
    expect(detectCountryFromTaxId("12345")).toBeNull();
    expect(detectCountryFromTaxId("ABC123")).toBeNull();
    expect(detectCountryFromTaxId("")).toBeNull();
  });
  it("does not detect non-EU prefixes", () => {
    expect(detectCountryFromTaxId("US123456789")).toBeNull();
  });
});

describe("slugify", () => {
  it("converts to lowercase kebab-case", () => {
    expect(slugify("My Company")).toBe("my-company");
    expect(slugify("John's Company")).toBe("johns-company");
    expect(slugify("  Spaces  Everywhere  ")).toBe("spaces-everywhere");
  });
});

describe("generateUniqueSlug", () => {
  it("generates a slug with random suffix", () => {
    const slug = generateUniqueSlug("Test Company");
    expect(slug).toMatch(/^test-company-[a-f0-9]{8}$/);
  });
});
