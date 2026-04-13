import { describe, it, expect } from "vitest";
import { formatInvoiceNumber } from "../lib/invoicing/numbering";

describe("formatInvoiceNumber", () => {
  it("generates basic number with prefix and padding", () => {
    const result = formatInvoiceNumber({
      prefix: "INV-",
      nextNumber: 1,
      digitCount: 4,
      includeYear: false,
    });
    expect(result).toBe("INV-0001");
  });

  it("pads number to specified digit count", () => {
    const result = formatInvoiceNumber({
      prefix: "INV-",
      nextNumber: 42,
      digitCount: 5,
      includeYear: false,
    });
    expect(result).toBe("INV-00042");
  });

  it("includes year when configured", () => {
    const result = formatInvoiceNumber({
      prefix: "INV-",
      nextNumber: 1,
      digitCount: 4,
      includeYear: true,
      year: 2026,
    });
    expect(result).toBe("INV-2026-0001");
  });

  it("uses current year when year not provided and includeYear is true", () => {
    const result = formatInvoiceNumber({
      prefix: "INV-",
      nextNumber: 7,
      digitCount: 4,
      includeYear: true,
    });
    const currentYear = new Date().getFullYear();
    expect(result).toBe(`INV-${currentYear}-0007`);
  });

  it("handles Greek-style numbering", () => {
    const result = formatInvoiceNumber({
      prefix: "\u03A4\u03A0\u03A5-",
      nextNumber: 1,
      digitCount: 4,
      includeYear: true,
      year: 2026,
    });
    expect(result).toBe("\u03A4\u03A0\u03A5-2026-0001");
  });

  it("handles quote prefix", () => {
    const result = formatInvoiceNumber({
      prefix: "QTE-",
      nextNumber: 15,
      digitCount: 4,
      includeYear: false,
    });
    expect(result).toBe("QTE-0015");
  });

  it("does not pad when number exceeds digit count", () => {
    const result = formatInvoiceNumber({
      prefix: "INV-",
      nextNumber: 99999,
      digitCount: 4,
      includeYear: false,
    });
    expect(result).toBe("INV-99999");
  });
});
