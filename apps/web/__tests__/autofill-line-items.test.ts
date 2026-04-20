import { describe, it, expect } from "vitest";
import { buildAutofilledLineItems } from "../lib/expenses/autofill-line-items";

describe("buildAutofilledLineItems — recomputes tax/line totals (#autofill-calc)", () => {
  it("populates taxAmount and lineTotal for each extracted line item (tax-exclusive)", () => {
    const items = buildAutofilledLineItems({
      lineItems: [
        {
          name: "ΠΥΡΟΣΒΕΣΤΗΡΑΣ",
          quantity: "1",
          unitPrice: "21.16",
          taxRate: "24",
        },
        {
          name: "ΚΟΥΒΕΡΤΑ 1.5x1.5",
          quantity: "1",
          unitPrice: "9.73",
          taxRate: "24",
        },
        {
          name: "ΚΟΥΒΕΡΤΑ 0.9x0.9",
          quantity: "1",
          unitPrice: "5.4",
          taxRate: "24",
        },
      ],
      defaultTaxRate: "24",
      usesInclusiveTax: false,
    });

    expect(items).toHaveLength(3);
    expect(items[0].taxAmount).toBe("5.08");
    expect(items[0].lineTotal).toBe("26.24");
    expect(items[1].taxAmount).toBe("2.34");
    expect(items[1].lineTotal).toBe("12.07");
    expect(items[2].taxAmount).toBe("1.30");
    expect(items[2].lineTotal).toBe("6.70");
  });

  it("falls back to defaultTaxRate when the extracted rate is empty or zero-string", () => {
    const items = buildAutofilledLineItems({
      lineItems: [
        { name: "A", quantity: "2", unitPrice: "10", taxRate: "" },
        { name: "B", quantity: "1", unitPrice: "10", taxRate: "0" },
      ],
      defaultTaxRate: "24",
      usesInclusiveTax: false,
    });
    // Both fall back to 24% → 20*0.24=4.80 and 10*0.24=2.40.
    expect(items[0].taxRate).toBe("24");
    expect(items[0].taxAmount).toBe("4.80");
    expect(items[0].lineTotal).toBe("24.80");
    expect(items[1].taxRate).toBe("24");
    expect(items[1].taxAmount).toBe("2.40");
    expect(items[1].lineTotal).toBe("12.40");
  });

  it("handles inclusive-tax totals by extracting tax from gross", () => {
    const items = buildAutofilledLineItems({
      lineItems: [
        { name: "Inc", quantity: "1", unitPrice: "124", taxRate: "24" },
      ],
      defaultTaxRate: "24",
      usesInclusiveTax: true,
    });
    expect(items[0].lineTotal).toBe("124.00");
    expect(items[0].taxAmount).toBe("24.00");
  });

  it("seeds an ids, sortOrder and required blank fields on each item", () => {
    const items = buildAutofilledLineItems({
      lineItems: [{ name: "A", quantity: "1", unitPrice: "5", taxRate: "24" }],
      defaultTaxRate: "24",
      usesInclusiveTax: false,
    });
    expect(typeof items[0].id).toBe("string");
    expect(items[0].id.length).toBeGreaterThan(0);
    expect(items[0].sortOrder).toBe(0);
    expect(items[0].productId).toBe("");
    expect(items[0].description).toBe("");
    expect(items[0].unit).toBe("");
    expect(items[0].taxCategory).toBe("");
  });
});

describe("buildAutofilledLineItems — single-item fallback from totalAmount", () => {
  it("produces one line priced at totalAmount with defaultTaxRate computed", () => {
    const items = buildAutofilledLineItems({
      lineItems: [],
      totalAmount: "45.00",
      description: "Πέμπτη Εκτύπωση",
      defaultTaxRate: "24",
      usesInclusiveTax: false,
    });
    expect(items).toHaveLength(1);
    expect(items[0].name).toBe("Πέμπτη Εκτύπωση");
    expect(items[0].quantity).toBe("1");
    expect(items[0].unitPrice).toBe("45.00");
    expect(items[0].taxRate).toBe("24");
    expect(items[0].taxAmount).toBe("10.80");
    expect(items[0].lineTotal).toBe("55.80");
  });

  it("returns an empty list when neither lineItems nor totalAmount is present", () => {
    const items = buildAutofilledLineItems({
      lineItems: [],
      defaultTaxRate: "24",
      usesInclusiveTax: false,
    });
    expect(items).toEqual([]);
  });
});
