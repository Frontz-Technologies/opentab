import { describe, it, expect } from "vitest";
import {
  calculateLineTotal,
  calculateInvoiceTotals,
  type LineItemInput,
} from "../lib/invoicing/calculations";

describe("calculateLineTotal", () => {
  it("calculates exclusive tax line total", () => {
    const result = calculateLineTotal({
      quantity: "2",
      unitPrice: "100.00",
      taxRate: "24.00",
      usesInclusiveTax: false,
    });

    expect(result.netAmount).toBe("200.00");
    expect(result.taxAmount).toBe("48.00");
    expect(result.lineTotal).toBe("248.00");
  });

  it("calculates inclusive tax line total", () => {
    const result = calculateLineTotal({
      quantity: "1",
      unitPrice: "124.00",
      taxRate: "24.00",
      usesInclusiveTax: true,
    });

    expect(result.netAmount).toBe("100.00");
    expect(result.taxAmount).toBe("24.00");
    expect(result.lineTotal).toBe("124.00");
  });

  it("handles zero tax rate", () => {
    const result = calculateLineTotal({
      quantity: "5",
      unitPrice: "10.00",
      taxRate: "0.00",
      usesInclusiveTax: false,
    });

    expect(result.netAmount).toBe("50.00");
    expect(result.taxAmount).toBe("0.00");
    expect(result.lineTotal).toBe("50.00");
  });

  it("handles fractional quantities", () => {
    const result = calculateLineTotal({
      quantity: "1.5",
      unitPrice: "100.00",
      taxRate: "24.00",
      usesInclusiveTax: false,
    });

    expect(result.netAmount).toBe("150.00");
    expect(result.taxAmount).toBe("36.00");
    expect(result.lineTotal).toBe("186.00");
  });

  it("rounds to 2 decimal places", () => {
    const result = calculateLineTotal({
      quantity: "3",
      unitPrice: "33.33",
      taxRate: "24.00",
      usesInclusiveTax: false,
    });

    expect(result.netAmount).toBe("99.99");
    expect(result.taxAmount).toBe("24.00");
    expect(result.lineTotal).toBe("123.99");
  });
});

describe("calculateInvoiceTotals", () => {
  it("sums multiple line items (exclusive tax)", () => {
    const items: LineItemInput[] = [
      { quantity: "2", unitPrice: "100.00", taxRate: "24.00" },
      { quantity: "1", unitPrice: "50.00", taxRate: "13.00" },
    ];

    const result = calculateInvoiceTotals(items, false);

    expect(result.subtotal).toBe("250.00");
    expect(result.taxAmount).toBe("54.50");
    expect(result.total).toBe("304.50");
  });

  it("sums multiple line items (inclusive tax)", () => {
    const items: LineItemInput[] = [
      { quantity: "1", unitPrice: "124.00", taxRate: "24.00" },
      { quantity: "1", unitPrice: "113.00", taxRate: "13.00" },
    ];

    const result = calculateInvoiceTotals(items, true);

    expect(result.subtotal).toBe("200.00");
    expect(result.taxAmount).toBe("37.00");
    expect(result.total).toBe("237.00");
  });

  it("returns zeros for empty items", () => {
    const result = calculateInvoiceTotals([], false);

    expect(result.subtotal).toBe("0.00");
    expect(result.taxAmount).toBe("0.00");
    expect(result.total).toBe("0.00");
  });

  it("handles mixed tax rates", () => {
    const items: LineItemInput[] = [
      { quantity: "1", unitPrice: "100.00", taxRate: "24.00" },
      { quantity: "1", unitPrice: "100.00", taxRate: "13.00" },
      { quantity: "1", unitPrice: "100.00", taxRate: "0.00" },
    ];

    const result = calculateInvoiceTotals(items, false);

    expect(result.subtotal).toBe("300.00");
    expect(result.taxAmount).toBe("37.00");
    expect(result.total).toBe("337.00");
  });
});
