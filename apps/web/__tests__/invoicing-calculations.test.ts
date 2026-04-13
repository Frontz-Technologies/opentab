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

  // #23: Inclusive tax edge cases
  it("inclusive tax: back-calculates correctly for 13% reduced rate", () => {
    const result = calculateLineTotal({
      quantity: "1",
      unitPrice: "56.50",
      taxRate: "13.00",
      usesInclusiveTax: true,
    });

    expect(result.netAmount).toBe("50.00");
    expect(result.taxAmount).toBe("6.50");
    expect(result.lineTotal).toBe("56.50");
  });

  it("inclusive tax: handles multiple quantities", () => {
    const result = calculateLineTotal({
      quantity: "3",
      unitPrice: "124.00",
      taxRate: "24.00",
      usesInclusiveTax: true,
    });

    // gross = 3 * 124 = 372.00
    // net = 372 / 1.24 = 300.00
    // tax = 372 - 300 = 72.00
    expect(result.netAmount).toBe("300.00");
    expect(result.taxAmount).toBe("72.00");
    expect(result.lineTotal).toBe("372.00");
  });

  it("inclusive tax: multi-line with mixed rates sums correctly", () => {
    const items: LineItemInput[] = [
      { quantity: "2", unitPrice: "62.00", taxRate: "24.00" },
      { quantity: "1", unitPrice: "6.36", taxRate: "6.00" },
    ];

    const result = calculateInvoiceTotals(items, true);

    // Line 1: gross=124, net=100, tax=24
    // Line 2: gross=6.36, net=6, tax=0.36
    expect(result.subtotal).toBe("106.00");
    expect(result.taxAmount).toBe("24.36");
    expect(result.total).toBe("130.36");
  });

  // #24: Multi-line item operations
  it("handles removing middle item from 3 items", () => {
    const items: LineItemInput[] = [
      { quantity: "1", unitPrice: "100.00", taxRate: "24.00" },
      { quantity: "1", unitPrice: "200.00", taxRate: "24.00" },
      { quantity: "1", unitPrice: "300.00", taxRate: "24.00" },
    ];

    const totalWith3 = calculateInvoiceTotals(items, false);
    expect(totalWith3.subtotal).toBe("600.00");
    expect(totalWith3.total).toBe("744.00");

    // Remove middle item
    const withoutMiddle = [items[0], items[2]];
    const totalWith2 = calculateInvoiceTotals(withoutMiddle, false);
    expect(totalWith2.subtotal).toBe("400.00");
    expect(totalWith2.total).toBe("496.00");
  });

  it("handles 5+ line items with different tax rates", () => {
    const items: LineItemInput[] = [
      { quantity: "10", unitPrice: "85.00", taxRate: "24.00" },
      { quantity: "1", unitPrice: "500.00", taxRate: "13.00" },
      { quantity: "5", unitPrice: "12.50", taxRate: "24.00" },
      { quantity: "1", unitPrice: "2500.00", taxRate: "0.00" },
      { quantity: "3", unitPrice: "45.00", taxRate: "6.00" },
    ];

    const result = calculateInvoiceTotals(items, false);

    // Line 1: 850 + 204 = 1054
    // Line 2: 500 + 65 = 565
    // Line 3: 62.50 + 15 = 77.50
    // Line 4: 2500 + 0 = 2500
    // Line 5: 135 + 8.10 = 143.10
    expect(result.subtotal).toBe("4047.50");
    expect(result.taxAmount).toBe("292.10");
    expect(result.total).toBe("4339.60");
  });

  it("single item invoice calculates correctly", () => {
    const items: LineItemInput[] = [
      { quantity: "1", unitPrice: "1000.00", taxRate: "24.00" },
    ];

    const result = calculateInvoiceTotals(items, false);

    expect(result.subtotal).toBe("1000.00");
    expect(result.taxAmount).toBe("240.00");
    expect(result.total).toBe("1240.00");
  });
});
