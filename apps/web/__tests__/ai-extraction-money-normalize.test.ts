import { describe, it, expect } from "vitest";
import { normalizeExtractedData } from "../lib/expenses/ai-extraction";
import { createDraftExpenseInputSchema } from "../lib/expenses/draft-expenses";

// When an AI extraction returns line-item `unitPrice` / `taxRate` /
// `quantity` strings the server-side regex rejects (commas, currency
// symbols, > max-decimal precision), the normalize layer must clean
// them up so the resulting object satisfies
// `createDraftExpenseInputSchema`. Anchored to the full pipeline — not
// just `.parse()` — so a regression in either normalizer or schema is
// caught.
describe("ai extraction money normalization", () => {
  const item = (overrides: Partial<Record<string, unknown>> = {}) => ({
    name: "Item",
    quantity: 1,
    unitPrice: 0,
    taxRate: 0,
    ...overrides,
  });

  it("rounds >2-decimal unitPrice to 2 decimals", () => {
    const out = normalizeExtractedData({
      lineItems: [item({ unitPrice: 0.9975 })],
    });
    expect(out.lineItems[0].unitPrice).toBe("1");
  });

  it("rounds >2-decimal taxRate to 2 decimals", () => {
    const out = normalizeExtractedData({
      lineItems: [item({ taxRate: 23.456 })],
    });
    expect(out.lineItems[0].taxRate).toBe("23.46");
  });

  it("rounds >4-decimal quantity to 4 decimals", () => {
    const out = normalizeExtractedData({
      lineItems: [item({ quantity: 1.123456 })],
    });
    expect(out.lineItems[0].quantity).toBe("1.1235");
  });

  it("converts comma decimal separator to period", () => {
    const out = normalizeExtractedData({
      lineItems: [
        item({ unitPrice: "3,99", taxRate: "23,5", quantity: "2,5" }),
      ],
    });
    expect(out.lineItems[0].unitPrice).toBe("3.99");
    expect(out.lineItems[0].taxRate).toBe("23.5");
    expect(out.lineItems[0].quantity).toBe("2.5");
  });

  it.each([
    ["3.99 €", "3.99"],
    ["$ 12.50", "12.5"],
    ["£0.50", "0.5"],
    ["¥100", "100"],
  ])("strips currency symbol from %s", (input, expected) => {
    const out = normalizeExtractedData({
      lineItems: [item({ unitPrice: input })],
    });
    expect(out.lineItems[0].unitPrice).toBe(expected);
  });

  it("falls back to default for unparseable strings", () => {
    const out = normalizeExtractedData({
      lineItems: [
        item({
          unitPrice: "not a price",
          taxRate: "n/a",
          quantity: "many",
        }),
      ],
    });
    expect(out.lineItems[0].unitPrice).toBe("0");
    expect(out.lineItems[0].taxRate).toBe("0");
    expect(out.lineItems[0].quantity).toBe("1");
  });

  it("falls back to default for negative values", () => {
    const out = normalizeExtractedData({
      lineItems: [item({ unitPrice: -5, taxRate: -1, quantity: -2 })],
    });
    expect(out.lineItems[0].unitPrice).toBe("0");
    expect(out.lineItems[0].taxRate).toBe("0");
    expect(out.lineItems[0].quantity).toBe("1");
  });

  it("preserves clean input as-is", () => {
    const out = normalizeExtractedData({
      lineItems: [item({ unitPrice: 12.5, taxRate: 24, quantity: 3 })],
    });
    expect(out.lineItems[0].unitPrice).toBe("12.5");
    expect(out.lineItems[0].taxRate).toBe("24");
    expect(out.lineItems[0].quantity).toBe("3");
  });

  // The whole point of bug 2: the normalized output must satisfy the server
  // schema. A unit test on `normalizeExtractedData` alone could regress
  // silently if the regex tightens; pin both ends of the pipe.
  it("produces line items that satisfy createDraftExpenseInputSchema", () => {
    const out = normalizeExtractedData({
      lineItems: [
        item({ unitPrice: 0.9975, taxRate: "23,456" }),
        item({ unitPrice: "3.99 €", taxRate: 6 }),
        item({ unitPrice: "$ 12.50", quantity: "2,5" }),
      ],
    });
    const draft = {
      categoryId: "",
      contactId: "",
      contactName: "",
      contactVatNumber: "",
      currencyCode: "EUR",
      description: "",
      expenseDate: "2026-05-02",
      notes: "",
      paymentDate: "",
      supplierInvoiceNumber: "",
      usesInclusiveTax: false,
      items: out.lineItems.map((li, i) => ({ ...li, sortOrder: i })),
    };
    const result = createDraftExpenseInputSchema.safeParse(draft);
    if (!result.success) {
      throw new Error(
        "schema rejected normalized payload: " +
          JSON.stringify(result.error.issues, null, 2),
      );
    }
    expect(result.success).toBe(true);
  });
});
